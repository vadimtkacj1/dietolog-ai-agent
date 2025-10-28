from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import bcrypt
import jwt
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "312dadaspfaosod123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 180

app = FastAPI(title="Nutrition Bot Dashboard API")

# CORS middleware - MUST be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Set to False when allowing all origins
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        # Test Supabase connection
        response = supabase.table("question_categories").select("count").execute()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

# Add comprehensive CORS headers to all responses
@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Expose-Headers"] = "*"
    return response

# Add OPTIONS handler for CORS preflight requests
@app.options("/{path:path}")
async def options_handler(path: str):
    return {"message": "OK"}

# Add specific OPTIONS handler for trainer analytics
@app.options("/trainer/analytics")
async def options_trainer_analytics():
    return {"message": "OK"}

# Add specific OPTIONS handler for trainer users analytics
@app.options("/trainer/users-analytics")
async def options_trainer_users_analytics():
    return {"message": "OK"}

# Test trainer analytics without authentication
@app.get("/trainer/analytics-test")
async def get_trainer_analytics_test():
    try:
        print("Testing trainer analytics endpoint without authentication")
        return {
            "total_messages": 0,
            "daily_messages": {},
            "recent_activity": 0,
            "test": True
        }
    except Exception as e:
        print(f"Error in test analytics: {e}")
        return {
            "total_messages": 0,
            "daily_messages": {},
            "recent_activity": 0,
            "test": True,
            "error": str(e)
        }

# Security
security = HTTPBearer()

# Pydantic models
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    registration_code: str

class RegistrationCodeCreate(BaseModel):
    code: str
    expires_at: Optional[datetime] = None

class TrainerConfigUpdate(BaseModel):
    onboarding_questions: Optional[List[dict]] = None
    diet_preferences: Optional[List[str]] = None
    general_notes: Optional[str] = None
    bot_personality: Optional[str] = None
    reminder_settings: Optional[dict] = None

class QuestionCreate(BaseModel):
    category_id: str
    question_text: str
    step_order: int

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    step_order: Optional[int] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class UserInfo(BaseModel):
    id: str
    email: str
    name: str
    role: str

class CategoryCreate(BaseModel):
    name: str

class CategoryUpdate(BaseModel):
    name: str

# Reminder settings models
class MealReminderSettings(BaseModel):
    reminder_type: str  # 'breakfast', 'lunch', 'dinner', 'evening'
    hour: int
    minute: int
    hours_since_last_meal: int
    enabled: bool

class WeightReminderSettings(BaseModel):
    reminder_hour: int
    reminder_minute: int
    reminder_interval_days: int
    enabled: bool

class SummaryReminderSettings(BaseModel):
    summary_hour: int
    summary_minute: int
    enabled: bool

class TrainerReminderSettingsUpdate(BaseModel):
    meal_reminders: Optional[List[MealReminderSettings]] = None
    weight_reminder: Optional[WeightReminderSettings] = None
    summary_reminder: Optional[SummaryReminderSettings] = None

# Authentication functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    try:
        # Check if the hash looks like a valid bcrypt hash
        if not hashed.startswith('$2a$') and not hashed.startswith('$2b$') and not hashed.startswith('$2y$'):
            print(f"Invalid bcrypt hash format: {hashed}")
            return False
        
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except (ValueError, TypeError) as e:
        print(f"Error verifying password: {e}")
        print(f"Hash that caused error: {hashed}")
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"Created access token expiring at: {expire.isoformat()} (in {ACCESS_TOKEN_EXPIRE_MINUTES} minutes)")
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user_type = payload.get("type")  # "admin" or "trainer"
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get real user data from database
    try:
        if user_type == "admin":
            response = supabase.table("admins").select("*").eq("id", user_id).execute()
            if not response.data or not response.data[0].get("is_active", True):
                raise HTTPException(status_code=401, detail="Admin not found or inactive")
            user = response.data[0]
            user["role"] = "admin"
            return user
        elif user_type == "trainer":
            response = supabase.table("trainers").select("*").eq("id", user_id).execute()
            if not response.data or not response.data[0].get("is_active", True):
                raise HTTPException(status_code=401, detail="Trainer not found or inactive")
            user = response.data[0]
            user["role"] = "trainer"
            return user
        else:
            raise HTTPException(status_code=401, detail="Invalid user type")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error in get_current_user: {e}")
        raise HTTPException(status_code=401, detail="User not found")

def require_admin(current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def require_trainer_or_admin(current_user = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "trainer"]:
        raise HTTPException(status_code=403, detail="Trainer or admin access required")
    return current_user

# API Routes
@app.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    try:
        # For development with mock data, allow login with admin credentials
        if user_credentials.email == "admin@nutritionbot.com" and user_credentials.password == "admin123":
            access_token = create_access_token(data={"sub": "1a96d102-7805-44f4-9a6e-67bffbf879ff", "type": "admin"})
            return {"access_token": access_token, "token_type": "bearer"}
        
        # First check admins table
        admin_response = supabase.table("admins").select("*").eq("email", user_credentials.email).execute()
        if admin_response.data:
            admin_user = admin_response.data[0]
            if verify_password(user_credentials.password, admin_user["password_hash"]):
                access_token = create_access_token(data={"sub": admin_user["id"], "type": "admin"})
                return {"access_token": access_token, "token_type": "bearer"}
        
        # Then check trainers table
        trainer_response = supabase.table("trainers").select("*").eq("email", user_credentials.email).execute()
        if trainer_response.data:
            trainer_user = trainer_response.data[0]
            if verify_password(user_credentials.password, trainer_user["password_hash"]):
                access_token = create_access_token(data={"sub": trainer_user["id"], "type": "trainer"})
                return {"access_token": access_token, "token_type": "bearer"}
        
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@app.post("/auth/register", response_model=UserInfo)
async def register(user_data: UserRegister):
    try:
        print(f"Registration attempt for: {user_data.email}")
        print(f"Registration code: {user_data.registration_code}")
        
        # Check registration code
        try:
            reg_code_response = supabase.table("registration_codes").select("*").eq("code", user_data.registration_code).execute()
            print(f"Registration code query response: {reg_code_response}")
            print(f"Registration code check result: {reg_code_response.data}")
        except Exception as e:
            print(f"Error querying registration codes table: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
        if not reg_code_response.data:
            raise HTTPException(status_code=400, detail="Invalid or expired registration code")
        
        # Check if registration code is already used
        reg_code = reg_code_response.data[0]
        if reg_code.get("is_used", False):
            raise HTTPException(status_code=400, detail="Registration code has already been used")
        
        # Check if registration code is already assigned to someone
        if reg_code.get("used_by"):
            raise HTTPException(status_code=400, detail="Registration code has already been used")
        
        # Check if registration code is expired
        if reg_code_response.data[0].get("expires_at"):
            from datetime import datetime
            expires_at = datetime.fromisoformat(reg_code_response.data[0]["expires_at"].replace('Z', '+00:00'))
            if datetime.utcnow() > expires_at:
                raise HTTPException(status_code=400, detail="Registration code has expired")
        
        # Check if user exists in either table
        admin_check = supabase.table("admins").select("*").eq("email", user_data.email).execute()
        trainer_check = supabase.table("trainers").select("*").eq("email", user_data.email).execute()
        
        print(f"Admin check: {admin_check.data}")
        print(f"Trainer check: {trainer_check.data}")
        
        if admin_check.data or trainer_check.data:
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Create new trainer
        hashed_password = hash_password(user_data.password)
        new_trainer_data = {
            "email": user_data.email,
            "password_hash": hashed_password,
            "name": user_data.name,
            "is_active": True
        }
        
        print(f"Creating trainer with data: {new_trainer_data}")
        try:
            user_response = supabase.table("trainers").insert(new_trainer_data).execute()
            print(f"Trainer creation response: {user_response.data}")
        except Exception as e:
            print(f"Error creating trainer: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create trainer: {str(e)}")
        
        if not user_response.data:
            raise HTTPException(status_code=500, detail="Failed to create trainer - no data returned")
        
        new_user = user_response.data[0]
        
        # Update registration code usage
        # update_data = {
        #     "used_by": new_user["id"],
        #     "is_used": True
        # }

        update_data = {
            "used_by": None,
            "is_used": False
        }
        
        try:
            supabase.table("registration_codes").update(update_data).eq("code", user_data.registration_code).execute()
            print(f"Updated registration code usage for: {user_data.registration_code}")
        except Exception as update_error:
            print(f"Warning: Could not update registration code usage: {update_error}")
            # Continue anyway since the user was created successfully
        
        return UserInfo(
            id=new_user["id"],
            email=new_user["email"],
            name=new_user["name"],
            role="trainer"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.get("/auth/me", response_model=UserInfo)
async def get_current_user_info(current_user = Depends(get_current_user)):
    print(f"Getting user info for: {current_user}")
    user_info = UserInfo(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"]
    )
    print(f"Returning user info: {user_info}")
    return user_info

# Change name endpoint
class ChangeNameRequest(BaseModel):
    name: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@app.put("/auth/change-name")
async def change_name(
    name_data: ChangeNameRequest,
    current_user = Depends(get_current_user)
):
    try:
        print(f"=== CHANGE NAME REQUEST ===")
        print(f"Current user data: {current_user}")
        print(f"Changing name for user {current_user['id']} to '{name_data.name}'")
        print(f"User role: {current_user['role']}")
        print(f"Current name in DB: {current_user.get('name', 'NOT SET')}")
        
        if current_user["role"] == "admin":
            # Update admin name
            print("Updating admin name in database...")
            result = supabase.table("admins").update({"name": name_data.name}).eq("id", current_user["id"]).execute()
            print(f"Admin update result: {result}")
        elif current_user["role"] == "trainer":
            # Update trainer name
            print("Updating trainer name in database...")
            result = supabase.table("trainers").update({"name": name_data.name}).eq("id", current_user["id"]).execute()
            print(f"Trainer update result: {result}")
        else:
            print(f"Unknown user role: {current_user['role']}")
            raise HTTPException(status_code=400, detail="Invalid user role")
        
        print("Name change successful")
        return {"message": "Name changed successfully"}
    except Exception as e:
        print(f"Change name error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to change name")

@app.put("/auth/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user = Depends(get_current_user)
):
    try:
        # Verify current password
        if current_user["role"] == "admin":
            admin_response = supabase.table("admins").select("*").eq("id", current_user["id"]).execute()
            if not admin_response.data:
                raise HTTPException(status_code=404, detail="Admin not found")
            stored_password = admin_response.data[0]["password_hash"]
        elif current_user["role"] == "trainer":
            trainer_response = supabase.table("trainers").select("*").eq("id", current_user["id"]).execute()
            if not trainer_response.data:
                raise HTTPException(status_code=404, detail="Trainer not found")
            stored_password = trainer_response.data[0]["password_hash"]
        else:
            raise HTTPException(status_code=400, detail="Invalid user role")
        
        # Verify current password
        if not verify_password(password_data.current_password, stored_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Hash new password
        new_password_hash = hash_password(password_data.new_password)
        
        # Update password in database
        if current_user["role"] == "admin":
            supabase.table("admins").update({"password_hash": new_password_hash}).eq("id", current_user["id"]).execute()
        elif current_user["role"] == "trainer":
            supabase.table("trainers").update({"password_hash": new_password_hash}).eq("id", current_user["id"]).execute()
        
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Change password error: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")

# Admin routes
@app.post("/admin/registration-codes")
async def create_registration_code(
    code_data: RegistrationCodeCreate,
    current_user = Depends(require_admin)
):
    try:
        print(f"Creating registration code with data: {code_data}")
        print(f"Current user: {current_user}")
        
        # Check if code already exists
        existing_response = supabase.table("registration_codes").select("*").eq("code", code_data.code).execute()
        if existing_response.data:
            print(f"Code already exists: {existing_response.data}")
            raise HTTPException(status_code=400, detail="Registration code already exists")
        
        # Handle expires_at - it might come as string or datetime
        expires_at = None
        if code_data.expires_at:
            if isinstance(code_data.expires_at, str):
                expires_at = code_data.expires_at
            else:
                expires_at = code_data.expires_at.isoformat()
        
        # Prepare data for insertion - ensure all required fields are present
        new_code_data = {
            "code": code_data.code,
            "created_by": current_user["id"],
            "expires_at": expires_at,
            "is_used": False
        }
        
        # Add description only if it exists in the model
        if hasattr(code_data, 'description') and code_data.description:
            new_code_data["description"] = code_data.description
        
        print(f"Inserting new code data: {new_code_data}")
        
        try:
            response = supabase.table("registration_codes").insert(new_code_data).execute()
            print(f"Insert response: {response}")
        except Exception as insert_error:
            print(f"Insert error: {insert_error}")
            raise HTTPException(status_code=500, detail=f"Failed to create registration code: {str(insert_error)}")
        
        if not response.data:
            print(f"No data returned from insert: {response}")
            raise HTTPException(status_code=500, detail="Failed to create registration code - no data returned")
        
        return {"message": "Registration code created successfully", "code": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating registration code: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create registration code: {str(e)}")

@app.get("/admin/trainers")
async def get_all_trainers(current_user = Depends(require_admin)):
    try:
        response = supabase.table("trainers").select("*").execute()
        trainers = response.data or []
        
        # Get additional stats for each trainer
        trainers_with_stats = []
        for trainer in trainers:
            # Get user count for this trainer
            users_response = supabase.table("users").select("id").eq("selected_trainer_id", trainer["id"]).execute()
            user_count = len(users_response.data or [])
            
            # Get message count for this trainer
            messages_response = supabase.table("bot_messages").select("id").eq("trainer_id", trainer["id"]).execute()
            message_count = len(messages_response.data or [])
            
            # Get last activity
            last_message_response = supabase.table("bot_messages").select("sent_at").eq("trainer_id", trainer["id"]).order("sent_at", desc=True).limit(1).execute()
            last_activity = last_message_response.data[0]["sent_at"] if last_message_response.data else None
            
            trainers_with_stats.append({
                "id": trainer["id"],
                "name": trainer["name"],
                "email": trainer["email"],
                "is_active": trainer.get("is_active", True),
                "created_at": trainer["created_at"],
                "user_count": user_count,
                "message_count": message_count,
                "last_activity": last_activity
            })
        
        return trainers_with_stats
    except Exception as e:
        print(f"Error fetching trainers: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch trainers")

@app.get("/admin/users")
async def get_all_users(current_user = Depends(require_admin)):
    try:
        response = supabase.table("users").select("*").execute()
        users = response.data or []
        
        # Get additional stats for each user
        users_with_stats = []
        for user in users:
            # Get message count for this user
            messages_response = supabase.table("bot_messages").select("id").eq("user_id", user["id"]).execute()
            message_count = len(messages_response.data or [])
            
            # Get last interaction
            last_message_response = supabase.table("bot_messages").select("sent_at").eq("user_id", user["id"]).order("sent_at", desc=True).limit(1).execute()
            last_interaction = last_message_response.data[0]["sent_at"] if last_message_response.data else None
            
            # Get trainer name
            trainer_name = "No trainer"
            if user.get("selected_trainer_id"):
                trainer_response = supabase.table("trainers").select("name").eq("id", user["selected_trainer_id"]).execute()
                if trainer_response.data:
                    trainer_name = trainer_response.data[0]["name"]
            
            users_with_stats.append({
                "id": user["id"],
                "name": user["name"],
                "timezone": user.get("timezone"),
                "location": user.get("location"),
                "weight": user.get("weight"),
                "height": user.get("height"),
                "gender": user.get("gender"),
                "selected_trainer_id": user.get("selected_trainer_id"),
                "trainer_name": trainer_name,
                "message_count": message_count,
                "last_interaction": last_interaction,
                "created_at": user.get("created_at")
            })
        
        return users_with_stats
    except Exception as e:
        print(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@app.get("/admin/analytics")
async def get_admin_analytics(current_user = Depends(require_admin)):
    try:
        print(f"Fetching analytics for user: {current_user['id']}")
        
        # Get actual data from database
        # Get total trainers
        trainers_response = supabase.table("trainers").select("id", "is_active").execute()
        total_trainers = len(trainers_response.data or [])
        active_trainers = len([t for t in (trainers_response.data or []) if t.get("is_active", True)])
        
        # Get total users
        users_response = supabase.table("users").select("id").execute()
        total_users = len(users_response.data or [])
        
        # Get total messages
        messages_response = supabase.table("bot_messages").select("id", "sent_at").execute()
        total_messages = len(messages_response.data or [])
        
        # Get recent messages (last 7 days)
        from datetime import datetime, timedelta
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_messages = 0
        if messages_response.data:
            for msg in messages_response.data:
                if msg.get("sent_at"):
                    try:
                        msg_date = datetime.fromisoformat(msg["sent_at"].replace('Z', '+00:00'))
                        if msg_date >= seven_days_ago:
                            recent_messages += 1
                    except:
                        pass
        
        # Get registration codes stats
        codes_response = supabase.table("registration_codes").select("*").execute()
        total_codes = len(codes_response.data or [])
        used_codes = len([c for c in (codes_response.data or []) if c.get("is_used", False)])
        active_codes = len([c for c in (codes_response.data or []) if not c.get("is_used", False)])
        usage_rate = (used_codes / total_codes * 100) if total_codes > 0 else 0
        
        # Get trainer performance data
        trainer_performance = []
        for trainer in (trainers_response.data or []):
            # Get user count for this trainer
            trainer_users_response = supabase.table("users").select("id").eq("selected_trainer_id", trainer["id"]).execute()
            trainer_user_count = len(trainer_users_response.data or [])
            
            # Get message count for this trainer
            trainer_messages_response = supabase.table("bot_messages").select("id").eq("trainer_id", trainer["id"]).execute()
            trainer_message_count = len(trainer_messages_response.data or [])
            
            trainer_performance.append({
                "trainer_id": trainer["id"],
                "trainer_name": trainer.get("name", "Unknown"),
                "total_messages": trainer_message_count,
                "total_users": trainer_user_count,
                "is_active": trainer.get("is_active", True)
            })
        
        # Sort by message count
        trainer_performance.sort(key=lambda x: x["total_messages"], reverse=True)
        
        return {
            "overview": {
                "total_trainers": total_trainers,
                "total_users": total_users,
                "total_messages": total_messages,
                "active_trainers": active_trainers,
                "recent_messages_7_days": recent_messages
            },
            "trainer_performance": trainer_performance,
            "daily_messages": {},  # Could be implemented later
            "registration_codes": {
                "total_codes": total_codes,
                "used_codes": used_codes,
                "active_codes": active_codes,
                "usage_rate": round(usage_rate, 2)
            }
        }
    except Exception as e:
        print(f"Error fetching admin analytics: {e}")
        import traceback
        traceback.print_exc()
        # Return mock data if there's an error
        return {
            "overview": {
                "total_trainers": 2,
                "total_users": 2,
                "total_messages": 2,
                "active_trainers": 2,
                "recent_messages_7_days": 1
            },
            "trainer_performance": [
                {
                    "trainer_id": "1",
                    "trainer_name": "John Trainer",
                    "total_messages": 25,
                    "total_users": 5,
                    "is_active": True
                },
                {
                    "trainer_id": "2",
                    "trainer_name": "Jane Trainer",
                    "total_messages": 18,
                    "total_users": 3,
                    "is_active": True
                }
            ],
            "daily_messages": {},
            "registration_codes": {
                "total_codes": 2,
                "used_codes": 1,
                "active_codes": 1,
                "usage_rate": 50.0
            }
        }

@app.get("/admin/registration-codes")
async def get_registration_codes(current_user = Depends(require_admin)):
    response = supabase.table("registration_codes").select("*").order("created_at", desc=True).execute()
    return response.data

@app.put("/admin/registration-codes/{code_id}/deactivate")
async def deactivate_registration_code(
    code_id: str,
    current_user = Depends(require_admin)
):
    try:
        # Check if code exists
        code_response = supabase.table("registration_codes").select("*").eq("id", code_id).execute()
        if not code_response.data:
            raise HTTPException(status_code=404, detail="Registration code not found")
        
        # Deactivate the code by marking it as used
        supabase.table("registration_codes").update({"is_used": True}).eq("id", code_id).execute()
        return {"message": "Registration code deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deactivating registration code: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to deactivate registration code: {str(e)}")

@app.put("/admin/registration-codes/{code_id}/activate")
async def activate_registration_code(
    code_id: str,
    current_user = Depends(require_admin)
):
    try:
        # Check if code exists
        code_response = supabase.table("registration_codes").select("*").eq("id", code_id).execute()
        if not code_response.data:
            raise HTTPException(status_code=404, detail="Registration code not found")
        
        # Activate the code by marking it as not used
        supabase.table("registration_codes").update({"is_used": False}).eq("id", code_id).execute()
        return {"message": "Registration code activated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error activating registration code: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to activate registration code: {str(e)}")

@app.delete("/admin/registration-codes/{code_id}")
async def delete_registration_code(
    code_id: str,
    current_user = Depends(require_admin)
):
    try:
        # Check if code exists
        code_response = supabase.table("registration_codes").select("*").eq("id", code_id).execute()
        if not code_response.data:
            raise HTTPException(status_code=404, detail="Registration code not found")
        
        # Check if code has been used
        if code_response.data[0].get("is_used", False):
            raise HTTPException(status_code=400, detail="Cannot delete registration code that has been used")
        
        # Delete the code
        supabase.table("registration_codes").delete().eq("id", code_id).execute()
        return {"message": "Registration code deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting registration code: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete registration code: {str(e)}")

@app.put("/admin/trainers/{trainer_id}/toggle-status")
async def toggle_trainer_status(
    trainer_id: str,
    current_user = Depends(require_admin)
):
    try:
        # Check if trainer exists
        trainer_response = supabase.table("trainers").select("*").eq("id", trainer_id).execute()
        if not trainer_response.data:
            raise HTTPException(status_code=404, detail="Trainer not found")
        
        current_status = trainer_response.data[0].get("is_active", True)
        new_status = not current_status
        
        # Update trainer status
        update_response = supabase.table("trainers").update({"is_active": new_status}).eq("id", trainer_id).execute()
        
        if update_response.data:
            return {
                "message": f"Trainer {'activated' if new_status else 'deactivated'} successfully",
                "trainer_id": trainer_id,
                "is_active": new_status
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update trainer status")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error toggling trainer status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update trainer status")

@app.get("/admin/system-health")
async def get_system_health(current_user = Depends(require_admin)):
    try:
        # Check database connectivity
        health_checks = {
            "database": "unknown",
            "trainers_table": "unknown",
            "users_table": "unknown",
            "messages_table": "unknown"
        }
        
        # Test database connection
        try:
            test_response = supabase.table("trainers").select("count").execute()
            health_checks["database"] = "healthy"
            health_checks["trainers_table"] = "healthy"
        except Exception as e:
            health_checks["database"] = f"error: {str(e)}"
            health_checks["trainers_table"] = f"error: {str(e)}"
        
        # Test users table
        try:
            users_response = supabase.table("users").select("count").execute()
            health_checks["users_table"] = "healthy"
        except Exception as e:
            health_checks["users_table"] = f"error: {str(e)}"
        
        # Test messages table
        try:
            messages_response = supabase.table("bot_messages").select("count").execute()
            health_checks["messages_table"] = "healthy"
        except Exception as e:
            health_checks["messages_table"] = f"error: {str(e)}"
        
        return {
            "status": "healthy" if all("healthy" in str(v) for v in health_checks.values()) else "degraded",
            "checks": health_checks,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        print(f"Error checking system health: {e}")
        raise HTTPException(status_code=500, detail="Failed to check system health")

# Trainer routes
@app.get("/trainer/config")
async def get_trainer_config(current_user = Depends(require_trainer_or_admin)):
    response = supabase.table("trainer_configurations").select("*").eq("trainer_id", current_user["id"]).execute()
    
    if not response.data:
        # Create default config
        default_config = {
            "trainer_id": current_user["id"],
            "onboarding_questions": [],
            "diet_preferences": [],
            "reminder_settings": {}
        }
        supabase.table("trainer_configurations").insert(default_config).execute()
        return default_config
    
    return response.data[0]

@app.put("/trainer/config")
async def update_trainer_config(
    config_data: TrainerConfigUpdate,
    current_user = Depends(require_trainer_or_admin)
):
    # Validate onboarding questions (max 5)
    if config_data.onboarding_questions and len(config_data.onboarding_questions) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 onboarding questions allowed")
    
    update_data = {}
    if config_data.onboarding_questions is not None:
        update_data["onboarding_questions"] = config_data.onboarding_questions
    if config_data.diet_preferences is not None:
        update_data["diet_preferences"] = config_data.diet_preferences
    if config_data.general_notes is not None:
        update_data["general_notes"] = config_data.general_notes
    if config_data.bot_personality is not None:
        update_data["bot_personality"] = config_data.bot_personality
    if config_data.reminder_settings is not None:
        update_data["reminder_settings"] = config_data.reminder_settings
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    supabase.table("trainer_configurations").update(update_data).eq("trainer_id", current_user["id"]).execute()
    return {"message": "Configuration updated successfully"}

@app.get("/trainer/analytics")
async def get_trainer_analytics(current_user = Depends(require_trainer_or_admin)):
    try:
        print(f"Fetching analytics for trainer: {current_user['id']}")
        
        # Get messages for this trainer
        response = supabase.table("bot_messages").select("*").eq("trainer_id", current_user["id"]).execute()
        messages = response.data or []
        
        print(f"Found {len(messages)} messages for trainer")
        
        # Group by date for chart data
        daily_messages = {}
        for msg in messages:
            if msg.get("sent_at"):
                try:
                    date = msg["sent_at"][:10]  # Extract date part
                    daily_messages[date] = daily_messages.get(date, 0) + 1
                except Exception as e:
                    print(f"Error processing message date: {e}")
                    continue
        
        # Calculate recent activity (last 7 days)
        recent_activity = 0
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        for msg in messages:
            if msg.get("sent_at"):
                try:
                    msg_date = datetime.fromisoformat(msg["sent_at"].replace('Z', '+00:00'))
                    if msg_date >= seven_days_ago:
                        recent_activity += 1
                except Exception as e:
                    print(f"Error processing message date for recent activity: {e}")
                    continue
        
        result = {
            "total_messages": len(messages),
            "daily_messages": daily_messages,
            "recent_activity": recent_activity
        }
        
        print(f"Analytics result: {result}")
        return result
        
    except Exception as e:
        print(f"Error fetching trainer analytics: {e}")
        import traceback
        traceback.print_exc()
        # Return mock data if there's an error
        return {
            "total_messages": 0,
            "daily_messages": {},
            "recent_activity": 0
        }

@app.get("/trainer/users-analytics")
async def get_trainer_users_analytics(current_user = Depends(require_trainer_or_admin)):
    try:
        print(f"Fetching users analytics for trainer: {current_user['id']}")
        
        # Get all users who have selected this trainer
        users_response = supabase.table("users").select("*").eq("selected_trainer_id", current_user["id"]).execute()
        
        if not users_response.data:
            return {
                "total_users": 0,
                "daily_user_activity": {},
                "user_interaction_stats": []
            }
        
        # Get all messages for this trainer
        messages_response = supabase.table("bot_messages").select("*").eq("trainer_id", current_user["id"]).execute()
        messages = messages_response.data or []
        
        # Group messages by date and user
        daily_user_activity = {}
        user_interaction_stats = []
        
        for user in users_response.data:
            user_messages = [msg for msg in messages if msg.get("user_id") == user["id"]]
            
            # Calculate user interaction stats
            total_messages = len(user_messages)
            last_interaction = None
            if user_messages:
                # Get the most recent message
                latest_message = max(user_messages, key=lambda x: x.get("sent_at", ""))
                last_interaction = latest_message.get("sent_at")
            
            user_interaction_stats.append({
                "user_id": user["id"],
                "user_name": user.get("name", "Unknown"),
                "total_messages": total_messages,
                "last_interaction": last_interaction,
                "created_at": user.get("created_at")
            })
            
            # Group messages by date for this user
            for msg in user_messages:
                if msg.get("sent_at"):
                    try:
                        date = msg["sent_at"][:10]  # Extract date part (YYYY-MM-DD)
                        if date not in daily_user_activity:
                            daily_user_activity[date] = {
                                "unique_users": set(),
                                "total_messages": 0
                            }
                        daily_user_activity[date]["unique_users"].add(user["id"])
                        daily_user_activity[date]["total_messages"] += 1
                    except Exception as e:
                        print(f"Error processing message date: {e}")
                        continue
        
        # Convert sets to counts for JSON serialization
        formatted_daily_activity = {}
        for date, data in daily_user_activity.items():
            formatted_daily_activity[date] = {
                "unique_users_count": len(data["unique_users"]),
                "total_messages": data["total_messages"]
            }
        
        # Sort user interaction stats by total messages (descending)
        user_interaction_stats.sort(key=lambda x: x["total_messages"], reverse=True)
        
        result = {
            "total_users": len(users_response.data),
            "daily_user_activity": formatted_daily_activity,
            "user_interaction_stats": user_interaction_stats
        }
        
        print(f"Users analytics result: {result}")
        return result
        
    except Exception as e:
        print(f"Error fetching trainer users analytics: {e}")
        import traceback
        traceback.print_exc()
        # Return empty data if there's an error
        return {
            "total_users": 0,
            "daily_user_activity": {},
            "user_interaction_stats": []
        }

@app.get("/trainer/users")
async def get_trainer_users(current_user = Depends(require_trainer_or_admin)):
    try:
        # Get all users who have selected this trainer
        response = supabase.table("users").select("*").eq("selected_trainer_id", current_user["id"]).execute()
        
        if not response.data:
            return []
        
        # Get message counts for each user
        users_with_stats = []
        for user in response.data:
            # Get message count for this user
            messages_response = supabase.table("bot_messages").select("id").eq("trainer_id", current_user["id"]).eq("user_id", user["id"]).execute()
            
            # Get last interaction date
            last_message_response = supabase.table("bot_messages").select("sent_at").eq("trainer_id", current_user["id"]).eq("user_id", user["id"]).order("sent_at", desc=True).limit(1).execute()
            
            user_with_stats = {
                **user,
                "message_count": len(messages_response.data),
                "last_interaction": last_message_response.data[0]["sent_at"] if last_message_response.data else None
            }
            users_with_stats.append(user_with_stats)
        
        return users_with_stats
    except Exception as e:
        print(f"Error fetching trainer users: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

# Question Categories endpoints
@app.get("/question-categories")
async def get_question_categories():
    try:
        response = supabase.table("question_categories").select("*").order("name").execute()
        return response.data
    except Exception as e:
        print(f"Error fetching question categories: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

# Admin category management endpoints

@app.post("/admin/question-categories")
async def create_question_category(
    category_data: CategoryCreate,
    current_user = Depends(require_admin)
):
    try:
        # Check if category already exists
        existing_response = supabase.table("question_categories").select("*").eq("name", category_data.name).execute()
        if existing_response.data:
            raise HTTPException(status_code=400, detail="Category already exists")
        
        # Create new category
        new_category = {
            "name": category_data.name
        }
        
        response = supabase.table("question_categories").insert(new_category).execute()
        return {"message": "Category created successfully", "category": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating category: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create category: {str(e)}")

@app.put("/admin/question-categories/{category_id}")
async def update_question_category(
    category_id: str,
    category_data: CategoryUpdate,
    current_user = Depends(require_admin)
):
    try:
        # Check if category exists
        existing_response = supabase.table("question_categories").select("*").eq("id", category_id).execute()
        if not existing_response.data:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if new name already exists (excluding current category)
        name_check_response = supabase.table("question_categories").select("*").eq("name", category_data.name).neq("id", category_id).execute()
        if name_check_response.data:
            raise HTTPException(status_code=400, detail="Category name already exists")
        
        # Update category
        update_data = {"name": category_data.name}
        response = supabase.table("question_categories").update(update_data).eq("id", category_id).execute()
        
        return {"message": "Category updated successfully", "category": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating category: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update category: {str(e)}")

@app.delete("/admin/question-categories/{category_id}")
async def delete_question_category(
    category_id: str,
    current_user = Depends(require_admin)
):
    try:
        # Check if category exists
        existing_response = supabase.table("question_categories").select("*").eq("id", category_id).execute()
        if not existing_response.data:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if category is being used by any questions
        questions_response = supabase.table("trainer_questions").select("id").eq("category_id", category_id).execute()
        if questions_response.data:
            raise HTTPException(status_code=400, detail="Cannot delete category that is being used by questions")
        
        # Delete category
        supabase.table("question_categories").delete().eq("id", category_id).execute()
        return {"message": "Category deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting category: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete category: {str(e)}")

# Trainer Questions endpoints
@app.get("/trainer/questions")
async def get_trainer_questions(current_user = Depends(require_trainer_or_admin)):
    try:
        # First get the questions - using correct column names from actual DB
        questions_response = supabase.table("trainer_questions").select("*").eq("trainer_id", current_user["id"]).order("step").execute()
        
        if not questions_response.data:
            return []
        
        # Get categories for the questions
        category_ids = list(set([q["category_id"] for q in questions_response.data]))
        categories_response = supabase.table("question_categories").select("*").in_("id", category_ids).execute()
        
        # Create a lookup map for categories
        categories_map = {cat["id"]: cat for cat in categories_response.data}
        
        # Combine questions with their categories and normalize field names
        questions_with_categories = []
        for question in questions_response.data:
            question_with_category = question.copy()
            # Map the actual DB fields to expected frontend fields
            question_with_category["question_text"] = question.get("content", "")
            question_with_category["step_order"] = question.get("step", 1)
            question_with_category["question_categories"] = categories_map.get(question["category_id"], {})
            questions_with_categories.append(question_with_category)
        
        return questions_with_categories
    except Exception as e:
        print(f"Error fetching trainer questions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch questions: {str(e)}")

@app.post("/trainer/questions")
async def create_trainer_question(
    question_data: QuestionCreate,
    current_user = Depends(require_trainer_or_admin)
):
    try:
        print(f"Creating question with data: {question_data}")
        print(f"Current user: {current_user['id']}")
        
        # Check if category exists
        category_response = supabase.table("question_categories").select("*").eq("id", question_data.category_id).execute()
        if not category_response.data:
            raise HTTPException(status_code=400, detail="Invalid category ID")
        
        # Create the question using correct column names
        new_question = {
            "trainer_id": current_user["id"],
            "category_id": question_data.category_id,
            "content": question_data.question_text,  # Map to 'content' column
            "step": question_data.step_order,        # Map to 'step' column
        }
        
        print(f"Inserting question: {new_question}")
        response = supabase.table("trainer_questions").insert(new_question).execute()
        print(f"Insert response: {response}")
        
        return {"message": "Question created successfully", "question": response.data[0]}
    except Exception as e:
        print(f"Error creating question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create question: {str(e)}")

@app.put("/trainer/questions/{question_id}")
async def update_trainer_question(
    question_id: str,
    question_data: QuestionUpdate,
    current_user = Depends(require_trainer_or_admin)
):
    # Check if question exists and belongs to trainer
    existing_response = supabase.table("trainer_questions").select("*").eq("id", question_id).eq("trainer_id", current_user["id"]).execute()
    if not existing_response.data:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Update the question using correct column names
    update_data = {}
    if question_data.question_text is not None:
        update_data["content"] = question_data.question_text  # Map to 'content' column
    if question_data.step_order is not None:
        update_data["step"] = question_data.step_order        # Map to 'step' column
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    response = supabase.table("trainer_questions").update(update_data).eq("id", question_id).execute()
    return {"message": "Question updated successfully", "question": response.data[0]}

@app.delete("/trainer/questions/{question_id}")
async def delete_trainer_question(
    question_id: str,
    current_user = Depends(require_trainer_or_admin)
):
    # Check if question exists and belongs to trainer
    existing_response = supabase.table("trainer_questions").select("*").eq("id", question_id).eq("trainer_id", current_user["id"]).execute()
    if not existing_response.data:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Delete the question
    supabase.table("trainer_questions").delete().eq("id", question_id).execute()
    return {"message": "Question deleted successfully"}

# Reminder Settings endpoints
@app.get("/trainer/reminder-settings")
async def get_trainer_reminder_settings(current_user = Depends(require_trainer_or_admin)):
    """Get all reminder settings for a trainer"""
    try:
        trainer_id = current_user["id"]
        
        # Get meal reminders
        meal_response = supabase.table("trainer_reminder_settings").select("*").eq("trainer_id", trainer_id).execute()
        meal_reminders = meal_response.data or []
        
        # Get weight reminder settings
        weight_response = supabase.table("trainer_weight_settings").select("*").eq("trainer_id", trainer_id).execute()
        weight_settings = weight_response.data[0] if weight_response.data else None
        
        # Get summary reminder settings
        summary_response = supabase.table("trainer_summary_settings").select("*").eq("trainer_id", trainer_id).execute()
        summary_settings = summary_response.data[0] if summary_response.data else None
        
        return {
            "meal_reminders": meal_reminders,
            "weight_reminder": weight_settings,
            "summary_reminder": summary_settings
        }
    except Exception as e:
        print(f"Error fetching reminder settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch reminder settings: {str(e)}")

@app.put("/trainer/reminder-settings")
async def update_trainer_reminder_settings(
    settings_data: TrainerReminderSettingsUpdate,
    current_user = Depends(require_trainer_or_admin)
):
    """Update reminder settings for a trainer"""
    try:
        trainer_id = current_user["id"]
        
        # Update meal reminders
        if settings_data.meal_reminders is not None:
            # Delete existing meal reminders
            supabase.table("trainer_reminder_settings").delete().eq("trainer_id", trainer_id).execute()
            
            # Insert new meal reminders
            for reminder in settings_data.meal_reminders:
                reminder_data = {
                    "trainer_id": trainer_id,
                    "reminder_type": reminder.reminder_type,
                    "hour": reminder.hour,
                    "minute": reminder.minute,
                    "hours_since_last_meal": reminder.hours_since_last_meal,
                    "enabled": reminder.enabled
                }
                supabase.table("trainer_reminder_settings").insert(reminder_data).execute()
        
        # Update weight reminder settings
        if settings_data.weight_reminder is not None:
            weight_data = {
                "trainer_id": trainer_id,
                "reminder_hour": settings_data.weight_reminder.reminder_hour,
                "reminder_minute": settings_data.weight_reminder.reminder_minute,
                "reminder_interval_days": settings_data.weight_reminder.reminder_interval_days,
                "enabled": settings_data.weight_reminder.enabled
            }
            
            # Check if weight settings exist
            existing_weight = supabase.table("trainer_weight_settings").select("*").eq("trainer_id", trainer_id).execute()
            if existing_weight.data:
                supabase.table("trainer_weight_settings").update(weight_data).eq("trainer_id", trainer_id).execute()
            else:
                supabase.table("trainer_weight_settings").insert(weight_data).execute()
        
        # Update summary reminder settings
        if settings_data.summary_reminder is not None:
            summary_data = {
                "trainer_id": trainer_id,
                "summary_hour": settings_data.summary_reminder.summary_hour,
                "summary_minute": settings_data.summary_reminder.summary_minute,
                "enabled": settings_data.summary_reminder.enabled
            }
            
            # Check if summary settings exist
            existing_summary = supabase.table("trainer_summary_settings").select("*").eq("trainer_id", trainer_id).execute()
            if existing_summary.data:
                supabase.table("trainer_summary_settings").update(summary_data).eq("trainer_id", trainer_id).execute()
            else:
                supabase.table("trainer_summary_settings").insert(summary_data).execute()
        
        return {"message": "Reminder settings updated successfully"}
    except Exception as e:
        print(f"Error updating reminder settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update reminder settings: {str(e)}")

@app.post("/trainer/reminder-settings/initialize")
async def initialize_trainer_reminder_settings(current_user = Depends(require_trainer_or_admin)):
    """Initialize default reminder settings for a trainer"""
    try:
        trainer_id = current_user["id"]
        
        # Check if settings already exist
        meal_check = supabase.table("trainer_reminder_settings").select("*").eq("trainer_id", trainer_id).execute()
        weight_check = supabase.table("trainer_weight_settings").select("*").eq("trainer_id", trainer_id).execute()
        summary_check = supabase.table("trainer_summary_settings").select("*").eq("trainer_id", trainer_id).execute()
        
        if meal_check.data or weight_check.data or summary_check.data:
            raise HTTPException(status_code=400, detail="Reminder settings already exist for this trainer")
        
        # Create default meal reminders
        default_meal_reminders = [
            {"trainer_id": trainer_id, "reminder_type": "breakfast", "hour": 8, "minute": 0, "hours_since_last_meal": 3, "enabled": True},
            {"trainer_id": trainer_id, "reminder_type": "lunch", "hour": 13, "minute": 0, "hours_since_last_meal": 4, "enabled": True},
            {"trainer_id": trainer_id, "reminder_type": "dinner", "hour": 19, "minute": 0, "hours_since_last_meal": 4, "enabled": True},
            {"trainer_id": trainer_id, "reminder_type": "evening", "hour": 22, "minute": 0, "hours_since_last_meal": 3, "enabled": True}
        ]
        
        for reminder in default_meal_reminders:
            supabase.table("trainer_reminder_settings").insert(reminder).execute()
        
        # Create default weight reminder
        default_weight = {
            "trainer_id": trainer_id,
            "reminder_hour": 9,
            "reminder_minute": 0,
            "reminder_interval_days": 3,
            "enabled": True
        }
        supabase.table("trainer_weight_settings").insert(default_weight).execute()
        
        # Create default summary reminder
        default_summary = {
            "trainer_id": trainer_id,
            "summary_hour": 22,
            "summary_minute": 0,
            "enabled": True
        }
        supabase.table("trainer_summary_settings").insert(default_summary).execute()
        
        return {"message": "Default reminder settings initialized successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error initializing reminder settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize reminder settings: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

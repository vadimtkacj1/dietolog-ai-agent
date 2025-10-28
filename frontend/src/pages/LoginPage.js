import React, { useState } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Space,
  message,
  Divider,
  Row,
  Col
} from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const result = await login(values.email, values.password);
      if (result.success) {
        message.success('Login successful!');
        // Navigate based on user role
        if (result.user?.role === 'admin') {
          navigate('/admin');
        } else if (result.user?.role === 'trainer') {
          navigate('/trainer');
        } else {
          navigate('/dashboard');
        }
      } else {
        message.error(result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
      message.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <Row justify="center" align="middle" style={{ minHeight: '100vh' }}>
        <Col 
          xs={22} 
          sm={18} 
          md={14} 
          lg={10} 
          xl={8} 
          xxl={6}
          style={{ width: '100%' }}
        >
          <Card className="auth-card">
            <div className="auth-header">
              <Title level={2} className="auth-title">
                Nutrition Bot
              </Title>
              <Text type="secondary" className="auth-subtitle">
                Trainer Management Panel
              </Text>
            </div>

            <Form
              name="login"
              onFinish={handleLogin}
              autoComplete="off"
              size="large"
              layout="vertical"
              validateTrigger="onBlur"
            >
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email!' },
                  { type: 'email', message: 'Invalid email format!' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="Enter your email" 
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: 'Please enter password!' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter your password"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: '24px' }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  className="auth-button"
                  block
                >
                  Login
                </Button>
              </Form.Item>
            </Form>

            <Divider>
              <Text type="secondary">Don't have an account?</Text>
            </Divider>

            <div className="auth-footer">
              <Button 
                type="link" 
                onClick={() => navigate('/register')}
                className="auth-link-button"
              >
                Sign up here
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <style jsx>{`
        .auth-page-container {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        
        .auth-card {
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          border-radius: 12px;
          border: none;
        }
        
        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }
        
        .auth-title {
          margin-bottom: 8px !important;
          color: #1890ff;
          font-weight: 600;
        }
        
        .auth-subtitle {
          font-size: 16px;
        }
        
        .auth-button {
          height: 48px;
          font-size: 16px;
          font-weight: 500;
          border-radius: 8px;
        }
        
        .auth-footer {
          text-align: center;
        }
        
        .auth-link-button {
          font-size: 16px;
          font-weight: 500;
          padding: 0;
          height: auto;
        }
        
        /* Mobile responsive */
        @media (max-width: 768px) {
          .auth-page-container {
            padding: 16px;
          }
          
          .auth-card {
            margin: 0;
          }
          
          .auth-title {
            font-size: 24px !important;
          }
          
          .auth-subtitle {
            font-size: 14px;
          }
        }
        
        @media (max-width: 480px) {
          .auth-page-container {
            padding: 12px;
          }
          
          .auth-header {
            margin-bottom: 24px;
          }
          
          .auth-title {
            font-size: 20px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;

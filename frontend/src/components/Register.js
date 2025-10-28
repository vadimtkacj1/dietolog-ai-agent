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
import { UserOutlined, LockOutlined, UserAddOutlined, KeyOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    const result = await register(
      values.email, 
      values.password, 
      values.name, 
      values.registrationCode
    );
    setLoading(false);
    
    if (result.success) {
      message.success('Registration successful!');
      navigate('/trainer');
    } else {
      message.error(result.error);
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
                Trainer Registration
              </Text>
            </div>

            <Form
              name="register"
              onFinish={onFinish}
              autoComplete="off"
              size="large"
              layout="vertical"
              validateTrigger="onBlur"
            >
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please input your name!' }]}
              >
                <Input 
                  prefix={<UserAddOutlined />} 
                  placeholder="Enter your full name" 
                />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please input your email!' },
                  { type: 'email', message: 'Please enter a valid email!' }
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
                rules={[
                  { required: true, message: 'Please input your password!' },
                  { min: 6, message: 'Password must be at least 6 characters!' }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="Enter your password" 
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirm Password"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Please confirm your password!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match!'));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="Confirm your password" 
                />
              </Form.Item>

              <Form.Item
                name="registrationCode"
                label="Registration Code"
                rules={[{ required: true, message: 'Please input your registration code!' }]}
              >
                <Input 
                  prefix={<KeyOutlined />} 
                  placeholder="Enter registration code" 
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
                  Register
                </Button>
              </Form.Item>
            </Form>

            <Divider>
              <Text type="secondary">Already have an account?</Text>
            </Divider>

            <div className="auth-footer">
              <Button 
                type="link" 
                onClick={() => navigate('/login')}
                className="auth-link-button"
              >
                Sign in here
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

export default Register;

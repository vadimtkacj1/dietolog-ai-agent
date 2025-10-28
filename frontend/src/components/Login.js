import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App, Tabs } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Register from './Register';

const { Title } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = async (values) => {
    setLoading(true);
    const result = await login(values.email, values.password);
    setLoading(false);
    
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
  };

  const items = [
    {
      key: 'login',
      label: 'Login',
      children: (
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
          validateTrigger="onSubmit"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Email" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Password" 
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
            >
              Login
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'register',
      label: 'Register',
      children: <Register />,
    },
  ];

  return (
    <div className="login-container">
      <Card className="login-form">
        <Title level={2} style={{ textAlign: 'center', marginBottom: 30 }}>
          Nutrition Bot Dashboard
        </Title>
        <Tabs defaultActiveKey="login" items={items} />
      </Card>
    </div>
  );
};

export default Login;

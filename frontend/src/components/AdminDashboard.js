import React, { useState, useEffect } from 'react';
import { Layout, Card, Statistic, Row, Col, Button, Table, Modal, Form, Input, Tabs, Typography, Tag, Switch, Tooltip, Badge, Popconfirm, App } from 'antd';
import { PlusOutlined, BarChartOutlined, SettingOutlined, HeartOutlined, ClockCircleOutlined, TagsOutlined } from '@ant-design/icons';
import { UserOutlined, MessageOutlined, TeamOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// Axios configuration is handled in AuthContext

const { Header, Content } = Layout;
const { Title } = Typography;

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { message } = App.useApp();
  const [analytics, setAnalytics] = useState({});
  const [trainers, setTrainers] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [registrationCodes, setRegistrationCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrationModalVisible, setRegistrationModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form] = Form.useForm();
  const [categoryForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch data with individual error handling
      const promises = [
        axios.get('/admin/analytics').catch(err => {
          console.error('Analytics error:', err);
          return { data: { overview: {}, trainer_performance: [], daily_messages: {}, registration_codes: {} } };
        }),
        axios.get('/admin/trainers').catch(err => {
          console.error('Trainers error:', err);
          return { data: [] };
        }),
        axios.get('/admin/users').catch(err => {
          console.error('Users error:', err);
          return { data: [] };
        }),
        axios.get('/question-categories').catch(err => {
          console.error('Categories error:', err);
          return { data: [] };
        }),
        axios.get('/admin/registration-codes').catch(err => {
          console.error('Registration codes error:', err);
          return { data: [] };
        })
      ];
      
      const [analyticsRes, trainersRes, usersRes, categoriesRes, codesRes] = await Promise.all(promises);
      
      setAnalytics(analyticsRes.data);
      setTrainers(trainersRes.data);
      setUsers(usersRes.data);
      setCategories(categoriesRes.data);
      setRegistrationCodes(codesRes.data);
    } catch (error) {
      console.error('Fetch data error:', error);
      message.error('Failed to fetch some data, but continuing with available data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRegistrationCode = async (values) => {
    try {
      console.log('Creating registration code with values:', values);
      console.log('Axios base URL:', axios.defaults.baseURL);
      console.log('Full URL will be:', `${axios.defaults.baseURL || ''}/admin/registration-codes`);
      console.log('Current user:', user);
      console.log('Auth token:', localStorage.getItem('token'));
      
      // Convert user_limit to number if provided and filter out empty values
      const data = {
        code: values.code,
        user_limit: values.user_limit ? parseInt(values.user_limit) : null,
        expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null
      };
      
      // Only add description if it's not empty
      if (values.description && values.description.trim()) {
        data.description = values.description.trim();
      }
      
      console.log('Sending data:', data);
      console.log('Request headers:', axios.defaults.headers);
      console.log('Authorization header:', axios.defaults.headers.common['Authorization']);
      
      const response = await axios.post('/admin/registration-codes', data);
      console.log('Response:', response.data);
      
      message.success('Registration code created successfully');
      setRegistrationModalVisible(false);
      form.resetFields();
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error creating registration code:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error config:', error.config);
      message.error('Failed to create registration code');
    }
  };

  const handleDeactivateCode = async (codeId) => {
    try {
      await axios.put(`/admin/registration-codes/${codeId}/deactivate`);
      message.success('Registration code deactivated successfully');
      fetchData(); // Refresh data
    } catch (error) {
      message.error('Failed to deactivate registration code');
    }
  };

  const handleActivateCode = async (codeId) => {
    try {
      await axios.put(`/admin/registration-codes/${codeId}/activate`);
      message.success('Registration code activated successfully');
      fetchData(); // Refresh data
    } catch (error) {
      message.error('Failed to activate registration code');
    }
  };

  const handleDeleteCode = async (codeId) => {
    try {
      await axios.delete(`/admin/registration-codes/${codeId}`);
      message.success('Registration code deleted successfully');
      fetchData(); // Refresh data
    } catch (error) {
      message.error('Failed to delete registration code');
    }
  };

  const handleCreateCategory = async (values) => {
    try {
      console.log('Creating category:', values);
      const response = await axios.post('/admin/question-categories', values);
      console.log('Create response:', response.data);
      message.success('Category created successfully');
      setCategoryModalVisible(false);
      categoryForm.resetFields();
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Create category error:', error.response?.data || error.message);
      message.error(`Failed to create category: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    categoryForm.setFieldsValue({ name: category.name });
    setCategoryModalVisible(true);
  };

  const handleUpdateCategory = async (values) => {
    try {
      console.log('Updating category:', editingCategory.id, values);
      const response = await axios.put(`/admin/question-categories/${editingCategory.id}`, values);
      console.log('Update response:', response.data);
      message.success('Category updated successfully');
      setCategoryModalVisible(false);
      setEditingCategory(null);
      categoryForm.resetFields();
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Update category error:', error.response?.data || error.message);
      message.error(`Failed to update category: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await axios.delete(`/admin/question-categories/${categoryId}`);
      message.success('Category deleted successfully');
      fetchData(); // Refresh data
    } catch (error) {
      message.error('Failed to delete category');
    }
  };

  const handleCategoryModalClose = () => {
    setCategoryModalVisible(false);
    setEditingCategory(null);
    categoryForm.resetFields();
  };

  const trainerColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Users',
      dataIndex: 'user_count',
      key: 'user_count',
      render: (count) => <Badge count={count} showZero color="blue" />,
    },
    {
      title: 'Messages',
      dataIndex: 'message_count',
      key: 'message_count',
      render: (count) => <Badge count={count} showZero color="green" />,
    },
    {
      title: 'Last Activity',
      dataIndex: 'last_activity',
      key: 'last_activity',
      render: (date) => date ? new Date(date).toLocaleString() : 'Never',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
    },
  ];

  const userColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (location) => location || 'Not specified',
    },
    {
      title: 'Trainer',
      dataIndex: 'trainer_name',
      key: 'trainer_name',
      render: (trainerName) => (
        <Tag color={trainerName === 'No trainer' ? 'red' : 'blue'}>
          {trainerName}
        </Tag>
      ),
    },
    {
      title: 'Messages',
      dataIndex: 'message_count',
      key: 'message_count',
      render: (count) => <Badge count={count} showZero color="green" />,
    },
    {
      title: 'Last Interaction',
      dataIndex: 'last_interaction',
      key: 'last_interaction',
      render: (date) => date ? new Date(date).toLocaleString() : 'Never',
    },
    {
      title: 'Weight/Height',
      key: 'physical',
      render: (_, record) => (
        <span>
          {record.weight ? `${record.weight}kg` : 'N/A'} / {record.height ? `${record.height}cm` : 'N/A'}
        </span>
      ),
    },
  ];

  const categoryColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Tag color="blue">{name}</Tag>,
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditCategory(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this category?"
            description="This action cannot be undone."
            onConfirm={() => handleDeleteCategory(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              Delete
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const registrationCodeColumns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc) => desc || '-',
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (_, record) => {
        const used = record.used_count || 0;
        const limit = record.user_limit;
        const limitText = limit ? `/${limit}` : '/∞';
        return (
          <span>
            {used}{limitText}
            {limit && used >= limit && <Tag color="red" style={{ marginLeft: 8 }}>Full</Tag>}
          </span>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const used = record.used_count || 0;
        const limit = record.user_limit;
        const isFull = limit && used >= limit;
        
        let color = 'green';
        let text = 'Active';
        
        // If code exceeds usage limit, show "Used"
        if (isFull) {
          color = 'red';
          text = 'Used';
        } else if (!record.is_active) {
          color = 'orange';
          text = 'Inactive';
        }
        
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: 'Expires At',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (date) => date ? new Date(date).toLocaleDateString() : 'Never',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const used = record.used_count || 0;
        const limit = record.user_limit;
        const isFull = limit && used >= limit;
        const canDelete = used === 0;
        
        return (
          <div>
            {record.is_active && !isFull && (
              <Popconfirm
                title="Are you sure you want to deactivate this code?"
                description="This will prevent new registrations with this code."
                onConfirm={() => handleDeactivateCode(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button type="link" danger size="small">
                  Deactivate
                </Button>
              </Popconfirm>
            )}
            
            {!record.is_active && !isFull && (
              <Button
                type="link"
                size="small"
                onClick={() => handleActivateCode(record.id)}
              >
                Activate
              </Button>
            )}
            
            {canDelete && (
              <Popconfirm
                title="Are you sure you want to delete this code?"
                description="This action cannot be undone."
                onConfirm={() => handleDeleteCode(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button type="link" danger size="small">
                  Delete
                </Button>
              </Popconfirm>
            )}
          </div>
        );
      },
    },
  ];

  const items = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Trainers"
                  value={analytics.overview?.total_trainers || 0}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Users"
                  value={analytics.overview?.total_users || 0}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Messages"
                  value={analytics.overview?.total_messages || 0}
                  prefix={<MessageOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Recent Messages (7 days)"
                  value={analytics.overview?.recent_messages_7_days || 0}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Registration Codes" extra={<HeartOutlined />}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic title="Total Codes" value={analytics.registration_codes?.total_codes || 0} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Used Codes" value={analytics.registration_codes?.used_codes || 0} />
                  </Col>
                  <Col span={8}>
                    <Statistic 
                      title="Usage Rate" 
                      value={analytics.registration_codes?.usage_rate || 0} 
                      suffix="%" 
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Top Performing Trainers">
                {analytics.trainer_performance?.slice(0, 3).map((trainer, index) => (
                  <div key={trainer.trainer_id} style={{ marginBottom: 8 }}>
                    <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze'}>
                      #{index + 1}
                    </Tag>
                    <strong>{trainer.trainer_name}</strong> - {trainer.total_messages} messages, {trainer.total_users} users
                  </div>
                ))}
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'trainers',
      label: 'Trainers',
      children: (
        <Card title="Trainers Management">
          <Table
            dataSource={trainers}
            columns={trainerColumns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </Card>
      ),
    },
    {
      key: 'users',
      label: 'Users',
      children: (
        <Card title="All Users">
          <Table
            dataSource={users}
            columns={userColumns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </Card>
      ),
    },
    {
      key: 'categories',
      label: 'Categories',
      children: (
        <Card
          title="Question Categories Management"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCategoryModalVisible(true)}
            >
              Add Category
            </Button>
          }
        >
          <Table
            dataSource={categories}
            columns={categoryColumns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 400 }}
          />
        </Card>
      ),
    },
    {
      key: 'registration-codes',
      label: 'Registration Codes',
      children: (
        <Card
          title="Registration Codes Management"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setRegistrationModalVisible(true)}
            >
              Create Code
            </Button>
          }
        >
          <Table
            dataSource={registrationCodes}
            columns={registrationCodeColumns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </Card>
      ),
    },
    // {
    //   key: 'analytics',
    //   label: 'Analytics',
    //   children: (
    //     <div>
    //       <Row gutter={16}>
    //         <Col span={12}>
    //           <Card title="Trainer Performance">
    //             <Table
    //               dataSource={analytics.trainer_performance || []}
    //               columns={[
    //                 { title: 'Rank', key: 'rank', render: (_, __, index) => index + 1 },
    //                 { title: 'Name', dataIndex: 'trainer_name', key: 'name' },
    //                 { title: 'Messages', dataIndex: 'total_messages', key: 'messages' },
    //                 { title: 'Users', dataIndex: 'total_users', key: 'users' },
    //                 { 
    //                   title: 'Status', 
    //                   dataIndex: 'is_active', 
    //                   key: 'status',
    //                   render: (isActive) => (
    //                     <Tag color={isActive ? 'green' : 'red'}>
    //                       {isActive ? 'Active' : 'Inactive'}
    //                     </Tag>
    //                   )
    //                 },
    //               ]}
    //               rowKey="trainer_id"
    //               pagination={false}
    //             />
    //           </Card>
    //         </Col>
    //         <Col span={12}>
    //           <Card title="System Health">
    //             <div style={{ textAlign: 'center', padding: '20px' }}>
    //               <HeartOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
    //               <div style={{ marginTop: '16px' }}>
    //                 <Title level={4}>System Status: Healthy</Title>
    //                 <p>All systems operational</p>
    //               </div>
    //             </div>
    //           </Card>
    //         </Col>
    //       </Row>
    //     </div>
    //   ),
    // },
  ];

  return (
    <Layout className="dashboard-container">
      <Header className="dashboard-header">
        <Title level={3} style={{ margin: 0 }}>
         Welcom to admin panel
        </Title>
        <div>
          <Button onClick={logout}>Logout</Button>
        </div>
      </Header>
      
      <Content className="dashboard-content">
        <Tabs defaultActiveKey="overview" items={items} />
        
        <Modal
          title="Create Registration Code"
          open={registrationModalVisible}
          onCancel={() => setRegistrationModalVisible(false)}
          footer={null}
          width={600}
          style={{ top: 20 }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateRegistrationCode}
          >
            <Form.Item
              name="code"
              label="Registration Code"
              rules={[{ required: true, message: 'Please input the code!' }]}
            >
              <Input placeholder="Enter registration code" />
            </Form.Item>
            
            <Form.Item
              name="description"
              label="Description (Optional)"
            >
              <Input placeholder="Enter description for this code" />
            </Form.Item>
            
            <Form.Item
              name="user_limit"
              label="User Limit"
              help="Leave empty for unlimited registrations"
            >
              <Input 
                type="number" 
                placeholder="Number of users (empty = unlimited)" 
                min={1}
              />
            </Form.Item>
            
            <Form.Item
              name="expires_at"
              label="Expiration Date (Optional)"
            >
              <Input 
                type="datetime-local" 
                placeholder="When should this code expire?"
              />
            </Form.Item>
            
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                Create Code
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={editingCategory ? "Edit Category" : "Create Category"}
          open={categoryModalVisible}
          onCancel={handleCategoryModalClose}
          footer={null}
          width={400}
          style={{ top: 20 }}
        >
          <Form
            form={categoryForm}
            layout="vertical"
            onFinish={editingCategory ? handleUpdateCategory : handleCreateCategory}
          >
            <Form.Item
              name="name"
              label="Category Name"
              rules={[
                { required: true, message: 'Please input the category name!' },
                { min: 2, message: 'Category name must be at least 2 characters!' },
                { max: 50, message: 'Category name must be less than 50 characters!' }
              ]}
            >
              <Input placeholder="Enter category name" />
            </Form.Item>
            
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                {editingCategory ? "Update Category" : "Create Category"}
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default AdminDashboard;

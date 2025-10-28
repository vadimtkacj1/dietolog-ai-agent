import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Card, Statistic, Row, Col, Button, Form, Input, Select, message, Tabs, Typography, Table, Spin, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, MessageOutlined, HolderOutlined, UserOutlined, BellOutlined, SettingOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import ReminderSettings from './ReminderSettings';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Set base URL for development
axios.defaults.baseURL = 'http://localhost:8000';

// Add request interceptor for better error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('Network error - backend might be down or CORS issue:', error);
      message.error('Cannot connect to backend server. Please check if the backend is running.');
    } else if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
      message.error('Server error occurred. Please try again.');
    } else if (error.response?.status === 401) {
      console.error('Authentication error:', error.response.data);
      message.error('Authentication failed. Please login again.');
    }
    return Promise.reject(error);
  }
);

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Sortable Question Item Component
const SortableQuestionItem = ({ question, onUpdate, onDelete, questionCategories, isDeleting }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef}
      style={{
        ...style,
        border: '1px solid #e8e8e8',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        backgroundColor: '#ffffff',
        marginBottom: 16
      }}
      size="small" 
      className="sortable-question-item"
    >
      <Row gutter={12} align="middle">
        <Col span={2}>
          <div
            {...attributes}
            {...listeners}
            style={{ 
              cursor: 'grab', 
              padding: '6px', 
              textAlign: 'center',
              borderRadius: '4px',
              // backgroundColor: '#f5f5f5',
              transition: 'all 0.2s ease'
            }}
          >
            <HolderOutlined style={{ color: '#999', fontSize: '14px' }} />
          </div>
        </Col>
        <Col span={2}>
          <div 
            style={{ 
              textAlign: 'center', 
              padding: '6px 8px',
              color: '#666',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '13px',
              minWidth: '32px'
            }}
          >
            {question.step_order}
          </div>
        </Col>
        <Col span={16}>
          <div style={{ padding: '6px 0' }}>
            <div style={{ 
              marginBottom: '6px',
              fontSize: '12px',
              color: '#666',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {question.question_categories?.name || 'Unknown Category'}
            </div>
            <div style={{ 
              fontSize: '14px',
              color: '#333',
              lineHeight: '1.4',
              fontWeight: '400'
            }}>
              {question.question_text}
            </div>
          </div>
        </Col>
        <Col span={4} style={{ textAlign: 'right' }}>
          <Button 
            danger 
            size="small"
            loading={isDeleting}
            onClick={async () => {
              try {
                await onDelete(question.id);
              } catch (error) {
                message.error('Failed to delete question');
              }
            }}
            style={{
              borderRadius: '4px',
              fontWeight: '500'
            }}
          >
            Delete
          </Button>
        </Col>
      </Row>
    </Card>
  );
};

const TrainerDashboard = () => {
  const { user, logout, updateUserInfo } = useAuth();
  const [config, setConfig] = useState({
    onboarding_questions: [],
    diet_preferences: [],
    general_notes: '',
    bot_personality: '',
    reminder_settings: {}
  });
  const [analytics, setAnalytics] = useState({});
  const [questionCategories, setQuestionCategories] = useState([]);
  const [trainerQuestions, setTrainerQuestions] = useState([]);
  const [trainerUsers, setTrainerUsers] = useState([]);
  const [usersAnalytics, setUsersAnalytics] = useState({});
  const [form] = Form.useForm();
  const [loadingStates, setLoadingStates] = useState({
    savingQuestion: false,
    deletingQuestion: false,
    savingConfig: false,
    loadingUsers: false
  });
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changeNameVisible, setChangeNameVisible] = useState(false);
  const [changeNameLoading, setChangeNameLoading] = useState(false);
  const [changePasswordForm] = Form.useForm();
  const [changeNameForm] = Form.useForm();

  // Global loading state - true if any operation is loading
  const isAnyLoading = Object.values(loadingStates).some(loading => loading);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  const fetchData = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, loadingUsers: true }));
    try {
      // Fetch data with individual error handling
      const promises = [
        axios.get('/trainer/config').catch(err => {
          console.error('Config fetch error:', err);
          return { data: { onboarding_questions: [], diet_preferences: [], general_notes: '', bot_personality: '', reminder_settings: {} } };
        }),
        axios.get('/trainer/analytics-test').catch(err => {
          console.error('Analytics fetch error:', err);
          return { data: { total_messages: 0, daily_messages: {}, recent_activity: 0 } };
        }),
        axios.get('/question-categories').catch(err => {
          console.error('Categories fetch error:', err);
          return { data: [] };
        }),
        axios.get('/trainer/questions').catch(err => {
          console.error('Questions fetch error:', err);
          return { data: [] };
        }),
        axios.get('/trainer/users-analytics').catch(err => {
          console.error('Users analytics fetch error:', err);
          return { data: { total_users: 0, daily_user_activity: {}, user_interaction_stats: [] } };
        }),
        axios.get('/trainer/users').catch(err => {
          console.error('Users fetch error:', err);
          return { data: [] };
        })
      ];
      
      const [configRes, analyticsRes, categoriesRes, questionsRes, usersAnalyticsRes, usersRes] = await Promise.all(promises);
      
      const configData = configRes.data;
      setConfig(configData);
      setAnalytics(analyticsRes.data);
      setQuestionCategories(categoriesRes.data);
      setTrainerQuestions(questionsRes.data);
      setUsersAnalytics(usersAnalyticsRes.data);
      setTrainerUsers(usersRes.data);
      
      // Ensure onboarding_questions is an array
      const formData = {
        ...configData,
        onboarding_questions: configData.onboarding_questions || []
      };
      
      form.setFieldsValue(formData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      message.error('Failed to fetch data');
    } finally {
      setLoadingStates(prev => ({ ...prev, loadingUsers: false }));
    }
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfigUpdate = async (values) => {
    setLoadingStates(prev => ({ ...prev, savingConfig: true }));
    try {
      // Validate onboarding questions (max 5)
      if (values.onboarding_questions && values.onboarding_questions.length > 5) {
        message.error('Maximum 5 onboarding questions allowed');
        return;
      }

      // Validate total questions (saved + form questions)
      const totalQuestions = trainerQuestions.length + (values.onboarding_questions ? values.onboarding_questions.length : 0);
      if (totalQuestions > 5) {
        message.error(`Total questions cannot exceed 5. You have ${trainerQuestions.length} saved questions and trying to add ${values.onboarding_questions ? values.onboarding_questions.length : 0} more.`);
        return;
      }

      console.log('Updating config with values:', values);
      await axios.put('/trainer/config', values);
      setConfig(values);
      message.success('Configuration updated successfully');
    } catch (error) {
      console.error('Config update error:', error);
      message.error('Failed to update configuration');
    } finally {
      setLoadingStates(prev => ({ ...prev, savingConfig: false }));
    }
  };

  const handleSaveQuestion = async (questionData, questionIndex) => {
    setLoadingStates(prev => ({ ...prev, savingQuestion: true }));
    try {
      console.log('Saving question:', questionData);
      
      if (!questionData.question || !questionData.category) {
        message.warning('Please fill in question and category');
        return;
      }

      // Validate maximum questions limit (5)
      if (trainerQuestions.length >= 5) {
        message.error('Maximum 5 questions allowed. Please delete an existing question first.');
        return;
      }

      // Find the category ID
      const category = questionCategories.find(cat => cat.name === questionData.category);
      if (!category) {
        message.error('Invalid category selected');
        return;
      }

      // Get the next step order (max existing step + 1)
      const maxStepOrder = trainerQuestions.length > 0 
        ? Math.max(...trainerQuestions.map(q => q.step_order || 0))
        : 0;
      const nextStepOrder = maxStepOrder + 1;

      const questionPayload = {
        category_id: category.id,
        question_text: questionData.question,
        step_order: nextStepOrder
      };

      console.log('Question payload:', questionPayload);
      const response = await axios.post('/trainer/questions', questionPayload);
      console.log('Question saved successfully:', response.data);
      message.success('Question saved successfully!');
      
      // Refresh the questions list
      const questionsRes = await axios.get('/trainer/questions');
      setTrainerQuestions(questionsRes.data);
      
      return true; // Return success indicator
    } catch (error) {
      console.error('Save question error:', error);
      console.error('Error details:', error.response?.data);
      message.error(`Failed to save question: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, savingQuestion: false }));
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = trainerQuestions.findIndex(item => item.id === active.id);
      const newIndex = trainerQuestions.findIndex(item => item.id === over.id);

      const newQuestions = arrayMove(trainerQuestions, oldIndex, newIndex);
      
      // Update step_order for all questions in the new order
      const updatedQuestions = newQuestions.map((question, index) => ({
        ...question,
        step_order: index + 1
      }));
      
      setTrainerQuestions(updatedQuestions);

      // Update step_order in database for all questions
      try {
        const updatePromises = updatedQuestions.map(question => 
          axios.put(`/trainer/questions/${question.id}`, {
            step_order: question.step_order
          })
        );
        
        await Promise.all(updatePromises);
        message.success('Question order updated successfully!');
      } catch (error) {
        console.error('Error updating question order:', error);
        message.error('Failed to update question order');
        // Revert the local state by fetching fresh data
        fetchData();
      }
    }
  };

  const handleUpdateQuestion = async (questionId, updateData) => {
    try {
      await axios.put(`/trainer/questions/${questionId}`, updateData);
      message.success('Question updated successfully!');
      fetchData();
    } catch (error) {
      console.error('Update question error:', error);
      message.error('Failed to update question');
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    setLoadingStates(prev => ({ ...prev, deletingQuestion: true }));
    try {
      await axios.delete(`/trainer/questions/${questionId}`);
      message.success('Question deleted successfully!');
      await fetchData(); // Ждем завершения обновления данных
    } catch (error) {
      console.error('Delete question error:', error);
      message.error('Failed to delete question');
    } finally {
      setLoadingStates(prev => ({ ...prev, deletingQuestion: false }));
    }
  };

  const handleChangePassword = async (values) => {
    setChangePasswordLoading(true);
    try {
      await axios.put('/auth/change-password', {
        current_password: values.currentPassword,
        new_password: values.newPassword
      });
      message.success('Password changed successfully!');
      setChangePasswordVisible(false);
      // Reset form fields
      changePasswordForm.resetFields();
    } catch (error) {
      console.error('Change password error:', error);
      message.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleChangeName = async (values) => {
    setChangeNameLoading(true);
    console.log(values.name)
    try {
      await axios.put('/auth/change-name', {
        name: values.name
      });
      message.success('Name changed successfully!');
      setChangeNameVisible(false);
      // Reset form fields
      changeNameForm.resetFields();
      // Refresh user data without page reload
      await updateUserInfo();
    } catch (error) {
      console.error('Change name error:', error);
      message.error(error.response?.data?.detail || 'Failed to change name');
    } finally {
      setChangeNameLoading(false);
    }
  };

  const handleInlineNameChange = async (newName) => {
    if (newName === user?.name || !newName.trim()) return;
    
    try {
      await axios.put('/auth/change-name', {
        name: newName.trim()
      });
      message.success('Name updated successfully!');
      // Refresh user data without page reload
      await updateUserInfo();
    } catch (error) {
      console.error('Inline name change error:', error);
      message.error(error.response?.data?.detail || 'Failed to update name');
    }
  };


  const formatChartData = () => {
    const dailyMessages = analytics.daily_messages || {};
    return Object.entries(dailyMessages).map(([date, count]) => ({
      date,
      messages: count
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const formatUsersChartData = () => {
    const dailyActivity = usersAnalytics.daily_user_activity || {};
    return Object.entries(dailyActivity).map(([date, data]) => ({
      date,
      uniqueUsers: data.unique_users_count,
      totalMessages: data.total_messages
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Define columns for users table
  const userColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => name || 'Not specified',
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (age) => age ? `${age} years` : 'Not specified',
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender) => gender || 'Not specified',
    },
    {
      title: 'Weight',
      dataIndex: 'weight',
      key: 'weight',
      render: (weight) => weight ? `${weight} kg` : 'Not specified',
    },
    {
      title: 'Height',
      dataIndex: 'height',
      key: 'height',
      render: (height) => height ? `${height} cm` : 'Not specified',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (location) => location || 'Not specified',
    },
    {
      title: 'Timezone',
      dataIndex: 'timezone',
      key: 'timezone',
      render: (timezone) => timezone || 'Not specified',
    },
    {
      title: 'Language',
      dataIndex: 'preferred_language',
      key: 'preferred_language',
      render: (language) => language || 'English',
    },
    {
      title: 'Messages',
      dataIndex: 'message_count',
      key: 'message_count',
      render: (count) => count || 0,
    },
    {
      title: 'Last Interaction',
      dataIndex: 'last_interaction',
      key: 'last_interaction',
      render: (date) => date ? new Date(date).toLocaleString() : 'Never',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => date ? new Date(date).toLocaleDateString() : 'Unknown',
    },
    {
      title: 'Status',
      dataIndex: 'is_correct',
      key: 'is_correct',
      render: (isCorrect) => (
        <span style={{ color: isCorrect ? '#52c41a' : '#ff4d4f' }}>
          {isCorrect ? 'Verified' : 'Pending'}
        </span>
      ),
    },
  ];

  const formatUserInteractionData = () => {
    const userStats = usersAnalytics.user_interaction_stats || [];
    return userStats.slice(0, 15).map((user, index) => ({
      name: user.user_name || `User ${index + 1}`,
      messages: user.total_messages || 0,
      lastInteraction: user.last_interaction ? new Date(user.last_interaction).toLocaleDateString() : 'Never',
      // Add a short name for better display
      shortName: user.user_name ? user.user_name.split(' ')[0] : `User${index + 1}`
    }));
  };

  const items = [
    {
      key: 'users',
      label: 'My Users',
      children: (
        <Spin spinning={loadingStates.loadingUsers} tip="Loading users data...">
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }} justify="center">
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Card style={{ textAlign: 'center', height: '100%' }}>
                <Statistic
                  title="Total Users"
                  value={usersAnalytics.total_users || 0}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Card style={{ textAlign: 'center', height: '100%' }}>
                <Statistic
                  title="Most Active User"
                  value={usersAnalytics.user_interaction_stats?.[0]?.user_name || 'No users'}
                  suffix={`(${usersAnalytics.user_interaction_stats?.[0]?.total_messages || 0} messages)`}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} justify="center">
            <Col xs={24} sm={24} md={24} lg={20} xl={18}>
              <Card 
                title="Daily User Activity" 
                className="analytics-chart"
                style={{ textAlign: 'center' }}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={formatUsersChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="uniqueUsers" 
                      stroke="#1890ff" 
                      strokeWidth={2}
                      name="Active Users"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="totalMessages" 
                      stroke="#52c41a" 
                      strokeWidth={2}
                      name="Total Messages"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* Users Details Table */}
          <Row gutter={[16, 16]} justify="center" style={{ marginTop: 24 }}>
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Card 
                title="My Users Details" 
                style={{ textAlign: 'center' }}
                extra={
                  <span style={{ color: '#666', fontSize: '14px' }}>
                    {trainerUsers.length} user{trainerUsers.length !== 1 ? 's' : ''}
                  </span>
                }
              >
                <Table
                  dataSource={trainerUsers}
                  columns={userColumns}
                  rowKey="id"
                  pagination={{ 
                    pageSize: window.innerWidth <= 576 ? 5 : 10,
                    showSizeChanger: window.innerWidth > 576,
                    showQuickJumper: window.innerWidth > 576,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
                    size: window.innerWidth <= 576 ? 'small' : 'default'
                  }}
                  scroll={{ 
                    x: window.innerWidth <= 576 ? 800 : 1200,
                    y: window.innerWidth <= 576 ? 400 : undefined
                  }}
                  size={window.innerWidth <= 576 ? 'small' : 'middle'}
                />
              </Card>
            </Col>
          </Row>

        </div>
        </Spin>
      ),
    },
    {
      key: 'config',
      label: 'Bot Configuration',
      children: (
        <div style={{ 
          maxWidth: '100%', 
          margin: '0 auto',
          padding: window.innerWidth <= 768 ? '0 12px' : '0'
        }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleConfigUpdate}
            initialValues={config}
          >
            <Card 
              title="Onboarding Questions" 
              className="config-section"
              style={{
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                backgroundColor: 'white',
                marginBottom: window.innerWidth <= 768 ? '16px' : '24px'
              }}
            >
            {/* Saved Questions Section with Drag and Drop */}
            {trainerQuestions.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={trainerQuestions.map(q => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {trainerQuestions
                      .sort((a, b) => a.step_order - b.step_order)
                      .map((question) => (
                        <SortableQuestionItem
                          key={question.id}
                          question={question}
                          onUpdate={handleUpdateQuestion}
                          onDelete={handleDeleteQuestion}
                          questionCategories={questionCategories}
                          isDeleting={loadingStates.deletingQuestion}
                        />
                      ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            <Form.Item
              name="onboarding_questions"
            >
              <Form.List 
                name="onboarding_questions"
                rules={[
                  {
                    validator: async (_, names) => {
                      if (names && names.length > 5) {
                        return Promise.reject(new Error('Maximum 5 questions allowed'));
                      }
                    },
                  },
                ]}
              >
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card 
                        key={key} 
                        size="small" 
                        style={{ 
                          marginBottom: 16,
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          backgroundColor: '#fafafa'
                        }}
                      >
                        <div style={{ marginBottom: 16 }}>
                          <Form.Item
                            {...restField}
                            name={[name, 'question']}
                            rules={[{ required: true, message: 'Question is required' }]}
                            style={{ marginBottom: 16 }}
                          >
                            <Input 
                              placeholder="Enter your question here..." 
                              size="large"
                              style={{ 
                                borderRadius: '8px',
                                fontSize: '16px',
                                padding: '12px 16px',
                                height: '48px'
                              }}
                            />
                          </Form.Item>
                          
                          <Row gutter={[12, 12]} align="middle">
                            <Col xs={18} sm={18} md={18} lg={20} xl={20}>
                              <Form.Item
                                {...restField}
                                name={[name, 'category']}
                                rules={[{ required: true, message: 'Category is required' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select 
                                  placeholder="Select category" 
                                  size="large"
                                  style={{ 
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    height: '48px'
                                  }}
                                >
                                  {questionCategories.map(category => (
                                    <Option key={category.id} value={category.name}>
                                      {category.name}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col xs={6} sm={6} md={6} lg={4} xl={4}>
                              <Button 
                                danger 
                                onClick={() => remove(name)}
                                size="large"
                                style={{ 
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  height: '48px',
                                  width: '100%'
                                }}
                              >
                                Delete
                              </Button>
                            </Col>
                          </Row>
                        </div>
                        <Row justify="end" style={{ marginTop: 20 }}>
                          <Button 
                            type="primary" 
                            size="large"
                            loading={loadingStates.savingQuestion}
                            onClick={async () => {
                              const questionData = form.getFieldValue(['onboarding_questions', name]);
                              const success = await handleSaveQuestion(questionData, name);
                              if (success) {
                                // Clear the form fields for this question
                                form.setFieldValue(['onboarding_questions', name, 'question'], '');
                                form.setFieldValue(['onboarding_questions', name, 'category'], undefined);
                              }
                            }}
                            style={{ 
                              borderRadius: '8px',
                              fontSize: '16px',
                              height: '48px',
                              minWidth: '140px',
                              fontWeight: '600'
                            }}
                          >
                            Save Question
                          </Button>
                        </Row>
                      </Card>
                    ))}
                    
                    <Button 
                      type="primary" 
                      onClick={() => {
                        const totalQuestions = trainerQuestions.length + fields.length;
                        if (totalQuestions >= 5) {
                          message.warning('Maximum 5 questions allowed. Please delete an existing question first.');
                          return;
                        }
                        add();
                      }}
                      disabled={trainerQuestions.length + fields.length >= 5 || loadingStates.savingQuestion}
                      block
                      size="large"
                      style={{
                        borderRadius: '8px',
                        fontSize: '16px',
                        height: '48px',
                        fontWeight: '600',
                        marginTop: '20px'
                      }}
                    >
                      {(trainerQuestions.length + fields.length >= 5 || loadingStates.savingQuestion) ? 'Maximum 5 Questions Reached' : 'Add New Question'}
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </Card>
          </Form>

          {/* Reminder Settings Section */}
          <Card 
            title="Reminder Settings" 
            className="config-section"
            style={{
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              backgroundColor: 'white',
              marginTop: '32px'
            }}
          >
            <ReminderSettings />
          </Card>
        </div>
      ),
    },
    {
      key: 'settings',
      label: 'Settings',
      children: (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Card 
            title="Account Settings" 
            className="config-section"
            style={{
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              backgroundColor: 'white',
              marginBottom: '24px'
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <Title level={4} style={{ marginBottom: '24px' }}>
                Account Settings
              </Title>
              
              <Form
                layout="vertical"
                style={{ maxWidth: '600px' }}
                initialValues={{
                  name: user?.name || '',
                  email: user?.email || ''
                }}
              >
                <Form.Item
                  label="Full Name"
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input 
                      value={user?.name || ''}
                      disabled
                      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
                    />
                    <Button 
                      type="primary" 
                      icon={<UserOutlined />}
                      onClick={() => setChangeNameVisible(true)}
                    >
                      Edit
                    </Button>
                  </div>
                </Form.Item>

                <Form.Item
                  label="Email Address"
                >
                  <Input 
                    value={user?.email || ''}
                    disabled
                    style={{ backgroundColor: '#f5f5f5' }}
                  />
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#999' }}>
                    Email address cannot be changed
                  </div>
                </Form.Item>

                <Form.Item
                  label="Password"
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input.Password 
                      value="••••••••"
                      disabled
                      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
                    />
                    <Button 
                      type="primary" 
                      icon={<SettingOutlined />}
                      onClick={() => setChangePasswordVisible(true)}
                    >
                      Change Password
                    </Button>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#999' }}>
                    Password is hidden for security reasons
                  </div>
                </Form.Item>
              </Form>
            </div>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <>
      <style>
        {`
          .sortable-question-item {
            margin-bottom: 16px;
            transition: all 0.2s ease;
          }
          .sortable-question-item:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            border-color: #d9d9d9;
          }
          .sortable-question-item[data-dragging="true"] {
            opacity: 0.8;
            transform: rotate(1deg);
          }
          
          /* Centered layout styles */
          .dashboard-container {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
          
          .dashboard-content {
            flex: 1;
            display: flex;
            justify-content: center;
            padding: 24px 16px;
          }
          
          .dashboard-content-wrapper {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }
          
          .dashboard-header {
            background: white;
            padding: 16px 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
          }
          
          .dashboard-header-content {
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          /* Mobile responsive styles */
          @media (max-width: 768px) {
            .dashboard-header {
              padding: 8px 12px;
              min-height: 56px;
            }
            .dashboard-header-content {
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              gap: 8px;
            }
            .dashboard-header-content h3 {
              font-size: 14px;
              margin: 0;
              line-height: 1.3;
              word-break: break-word;
            }
            .dashboard-header-content > div {
              flex-shrink: 0;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .dashboard-content {
              padding: 12px 8px;
            }
            .dashboard-content-wrapper {
              max-width: 100%;
            }
            .analytics-chart {
              margin-bottom: 16px;
            }
            .ant-card {
              margin-bottom: 16px;
            }
            .ant-statistic-title {
              font-size: 12px;
            }
            .ant-statistic-content {
              font-size: 18px;
            }
            .ant-tabs-content-holder {
              padding: 0;
            }
            .ant-tabs-tab {
              padding: 8px 12px;
              font-size: 13px;
            }
            .ant-tabs-nav {
              margin-bottom: 16px;
            }
            
            /* Bot Configuration mobile styles */
            .config-section {
              margin-bottom: 20px !important;
            }
            
            .config-section .ant-card-body {
              padding: 24px !important;
            }
            
            .config-section .ant-card-head {
              padding: 20px 24px !important;
            }
            
            .config-section .ant-card-head-title {
              font-size: 18px !important;
              font-weight: 600 !important;
            }
            
            .ant-form-item {
              margin-bottom: 16px !important;
            }
            
            .ant-form-item-label > label {
              font-size: 14px !important;
              font-weight: 500 !important;
            }
            
            .ant-input,
            .ant-select-selector {
              font-size: 16px !important;
              border-radius: 8px !important;
              height: 48px !important;
            }
            
            .ant-btn {
              border-radius: 8px !important;
              font-weight: 600 !important;
              height: 44px !important;
              font-size: 14px !important;
              padding: 8px 16px !important;
              min-width: 80px !important;
            }
            
            .ant-btn-danger {
              font-size: 13px !important;
              height: 40px !important;
              padding: 6px 12px !important;
            }
            
            .ant-btn-primary {
              font-size: 14px !important;
              height: 44px !important;
              padding: 8px 20px !important;
            }
            
            /* Question cards mobile styles */
            .sortable-question-item {
              margin-bottom: 16px !important;
            }
            
            .sortable-question-item .ant-card-body {
              padding: 20px !important;
            }
          }
          
          @media (max-width: 576px) {
            .dashboard-header {
              padding: 6px 8px;
              min-height: 50px;
            }
            .dashboard-header-content h3 {
              font-size: 12px;
              line-height: 1.2;
            }
            .ant-tabs-tab {
              font-size: 12px;
              padding: 6px 8px;
            }
            .ant-card-head-title {
              font-size: 14px;
            }
            .dashboard-content {
              padding: 8px 4px;
            }
            
            /* Bot Configuration small screen styles */
            .config-section .ant-card-body {
              padding: 20px !important;
            }
            
            .config-section .ant-card-head {
              padding: 16px 20px !important;
            }
            
            .config-section .ant-card-head-title {
              font-size: 16px !important;
            }
            
            .ant-form-item {
              margin-bottom: 14px !important;
            }
            
            .ant-form-item-label > label {
              font-size: 13px !important;
            }
            
            .ant-btn {
              height: 40px !important;
              font-size: 13px !important;
              padding: 6px 12px !important;
              min-width: 70px !important;
            }
            
            .ant-btn-danger {
              font-size: 12px !important;
              height: 36px !important;
              padding: 4px 10px !important;
            }
            
            .ant-btn-primary {
              font-size: 13px !important;
              height: 40px !important;
              padding: 6px 16px !important;
            }
            
            .ant-input,
            .ant-select-selector {
              font-size: 16px !important;
              height: 44px !important;
              padding: 12px 16px !important;
            }
            
            /* Question cards small screen styles */
            .sortable-question-item .ant-card-body {
              padding: 16px !important;
            }
          }
          
          @media (min-width: 1400px) {
            .dashboard-content-wrapper {
              max-width: 1400px;
            }
            .dashboard-header-content {
              max-width: 1400px;
            }
          }
          
          /* Global Loading Overlay Animation */
          .global-loading-overlay {
            animation: fadeIn 0.3s ease-in-out;
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          
          .global-loading-content {
            animation: slideUp 0.3s ease-out;
          }
          
          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <Layout className="dashboard-container">
        <Header className="dashboard-header">
          <div className="dashboard-header-content">
            <Title level={3} style={{ 
              margin: 0, 
              fontSize: window.innerWidth <= 576 ? '12px' : window.innerWidth <= 768 ? '14px' : '20px',
              lineHeight: window.innerWidth <= 768 ? '1.3' : '1.4',
              textAlign: window.innerWidth <= 768 ? 'center' : 'left'
            }}>
              {window.innerWidth <= 576 ? `Welcome, ${user?.name || 'Trainer'}!` : 
               window.innerWidth <= 768 ? `Welcome ${user?.name || 'Trainer'}!` : 
               `Welcome to Trainer Dashboard, ${user?.name || 'Trainer'}!`}
            </Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {isAnyLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Spin size="small" />
                  <Text style={{ color: '#1890ff', fontSize: '14px' }}>Processing...</Text>
                </div>
              )}
              <Button 
                onClick={logout}
                size={window.innerWidth <= 576 ? 'small' : 'middle'}
                style={{
                  fontSize: window.innerWidth <= 576 ? '12px' : '14px',
                  height: window.innerWidth <= 576 ? '32px' : '36px',
                  padding: window.innerWidth <= 576 ? '4px 12px' : '6px 16px'
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </Header>
        
        <Content className="dashboard-content">
          <div className="dashboard-content-wrapper">
            <Tabs defaultActiveKey="users" items={items} />
          </div>
        </Content>
        
        {/* Global Loading Overlay */}
        {isAnyLoading && (
          <div className="global-loading-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(2px)'
          }}>
            <div className="global-loading-content" style={{
              textAlign: 'center',
              padding: '24px',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              border: '1px solid #f0f0f0'
            }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px', fontSize: '16px', color: '#1890ff', fontWeight: '500' }}>
                Processing your request...
              </div>
            </div>
          </div>
        )}
        
        {/* Change Password Modal */}
        <Modal
          title="Change Password"
          open={changePasswordVisible}
          onCancel={() => {
            setChangePasswordVisible(false);
            changePasswordForm.resetFields();
          }}
          footer={null}
          width={400}
          style={{ top: 20 }}
        >
          <Form
            form={changePasswordForm}
            name="changePassword"
            onFinish={handleChangePassword}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="currentPassword"
              label="Current Password"
              rules={[{ required: true, message: 'Please enter your current password!' }]}
            >
              <Input.Password placeholder="Enter current password" />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="New Password"
              rules={[
                { required: true, message: 'Please enter new password!' },
                { min: 6, message: 'Password must be at least 6 characters!' }
              ]}
            >
              <Input.Password placeholder="Enter new password" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Confirm New Password"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Please confirm new password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match!'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm new password" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Button 
                onClick={() => {
                  setChangePasswordVisible(false);
                  changePasswordForm.resetFields();
                }}
                style={{ marginRight: '8px' }}
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={changePasswordLoading}
              >
                Change Password
              </Button>
            </Form.Item>
          </Form>
        </Modal>
        
        {/* Change Name Modal */}
        <Modal
          title="Change Name"
          open={changeNameVisible}
          onCancel={() => {
            setChangeNameVisible(false);
            changeNameForm.resetFields();
          }}
          footer={null}
          width={400}
          style={{ top: 20 }}
        >
          <Form
            form={changeNameForm}
            name="changeName"
            onFinish={handleChangeName}
            layout="vertical"
            size="large"
            initialValues={{ name: user?.name || '' }}
          >
            <Form.Item
              name="name"
              label="Full Name"
              rules={[
                { required: true, message: 'Please enter your name!' },
                { min: 2, message: 'Name must be at least 2 characters!' }
              ]}
            >
              <Input placeholder="Enter your full name" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Button 
                onClick={() => {
                  setChangeNameVisible(false);
                  changeNameForm.resetFields();
                }}
                style={{ marginRight: '8px' }}
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={changeNameLoading}
              >
                Change Name
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </Layout>
    </>
  );
};

export default TrainerDashboard;

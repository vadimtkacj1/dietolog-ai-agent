import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Button,
  TimePicker,
  Space,
  Typography,
  Row,
  Col,
  message,
  Spin,
  Alert
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ReminderSettings = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    meal_reminders: [],
    weight_reminder: null,
    summary_reminder: null
  });

  const mealReminderTypes = [
    { key: 'breakfast', label: 'Breakfast', defaultHours: 3 },
    { key: 'lunch', label: 'Lunch', defaultHours: 4 },
    { key: 'dinner', label: 'Dinner', defaultHours: 4 },
    { key: 'evening', label: 'Evening Reminder', defaultHours: 3 }
  ];

  // Function to disable minutes except 0, 15, 30, 45
  const disabledMinutes = () => {
    const allowedMinutes = [0, 15, 30, 45];
    return Array.from({ length: 60 }, (_, i) => i).filter(minute => !allowedMinutes.includes(minute));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/trainer/reminder-settings');
      const data = response.data;
      setSettings(data);
      
      // Populate form with existing settings
      const formData = {
        meal_reminders: data.meal_reminders.map(reminder => ({
          ...reminder,
          time: dayjs().hour(reminder.hour).minute(reminder.minute)
        })),
        weight_reminder: data.weight_reminder ? {
          ...data.weight_reminder,
          time: dayjs().hour(data.weight_reminder.reminder_hour).minute(data.weight_reminder.reminder_minute)
        } : null,
        summary_reminder: data.summary_reminder ? {
          ...data.summary_reminder,
          time: dayjs().hour(data.summary_reminder.summary_hour).minute(data.summary_reminder.summary_minute)
        } : null
      };
      
      form.setFieldsValue(formData);
    } catch (error) {
      console.error('Error loading settings:', error);
      message.error('Error loading reminder settings');
    } finally {
      setLoading(false);
    }
  };

  const initializeSettings = async () => {
    setSaving(true);
    try {
      await axios.post('/trainer/reminder-settings/initialize');
      message.success('Reminder settings initialized successfully');
      loadSettings();
    } catch (error) {
      console.error('Error initializing settings:', error);
      message.error('Error initializing reminder settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const updateData = {
        meal_reminders: values.meal_reminders?.map(reminder => ({
          reminder_type: reminder.reminder_type,
          hour: reminder.time.hour(),
          minute: reminder.time.minute(),
          hours_since_last_meal: reminder.hours_since_last_meal,
          enabled: reminder.enabled
        })) || [],
        weight_reminder: values.weight_reminder ? {
          reminder_hour: values.weight_reminder.time.hour(),
          reminder_minute: values.weight_reminder.time.minute(),
          reminder_interval_days: values.weight_reminder.reminder_interval_days,
          enabled: values.weight_reminder.enabled
        } : null,
        summary_reminder: values.summary_reminder ? {
          summary_hour: values.summary_reminder.time.hour(),
          summary_minute: values.summary_reminder.time.minute(),
          enabled: values.summary_reminder.enabled
        } : null
      };

      await axios.put('/trainer/reminder-settings', updateData);
      message.success('Reminder settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      message.error('Error saving reminder settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>Loading reminder settings...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {settings.meal_reminders.length === 0 && !settings.weight_reminder && !settings.summary_reminder && (
        <Alert
          message="Reminder settings not initialized"
          description="Click 'Initialize' button to create default reminder settings."
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
          action={
            <Button 
              type="primary" 
              icon={<ReloadOutlined />}
              onClick={initializeSettings}
              loading={saving}
            >
              Initialize
            </Button>
          }
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          meal_reminders: mealReminderTypes.map(type => ({
            reminder_type: type.key,
            enabled: true,
            hours_since_last_meal: type.defaultHours,
            time: dayjs().hour(8).minute(0)
          })),
          weight_reminder: {
            enabled: true,
            reminder_interval_days: 3,
            time: dayjs().hour(9).minute(0)
          },
          summary_reminder: {
            enabled: true,
            time: dayjs().hour(22).minute(0)
          }
        }}
      >
        {/* Meal Reminders */}
        <Card title="Meal Reminders" style={{ marginBottom: '24px' }}>
          <Form.List name="meal_reminders">
            {(fields) => (
              <>
                {fields.map((field, index) => {
                  const reminderType = mealReminderTypes[index];
                  return (
                    <Card key={field.key} size="small" style={{ marginBottom: '20px', borderRadius: '8px' }}>
                      <div style={{ padding: '16px' }}>
                        {/* Header with meal name and switch */}
                        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: '16px' }}>
                          <Col xs={12} sm={8} md={6}>
                            <Text strong style={{ fontSize: '16px' }}>{reminderType.label}</Text>
                          </Col>
                          <Col xs={12} sm={4} md={4}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'enabled']}
                              valuePropName="checked"
                              style={{ marginBottom: 0 }}
                            >
                              <Switch size="default" />
                            </Form.Item>
                          </Col>
                        </Row>
                        
                        {/* Time and Hours settings */}
                        <Row gutter={[16, 16]} align="top">
                          <Col xs={24} sm={12} md={12}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'time']}
                              label={<span style={{ fontSize: '14px', fontWeight: '500' }}>Time</span>}
                              style={{ marginBottom: 0 }}
                            >
                              <TimePicker 
                                format="HH:mm" 
                                style={{ 
                                  width: '100%',
                                  height: '40px',
                                  borderRadius: '6px'
                                }} 
                                minuteStep={15}
                                showNow={false}
                                disabledMinutes={disabledMinutes}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={12} md={12}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'hours_since_last_meal']}
                              label={<span style={{ fontSize: '14px', fontWeight: '500' }}>Hours since last meal</span>}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber 
                                min={1} 
                                max={24} 
                                style={{ 
                                  width: '100%',
                                  height: '40px',
                                  borderRadius: '6px'
                                }} 
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        
                        {/* Hidden field */}
                        <Form.Item
                          {...field}
                          name={[field.name, 'reminder_type']}
                          style={{ display: 'none' }}
                        >
                          <input type="hidden" />
                        </Form.Item>
                      </div>
                    </Card>
                  );
                })}
              </>
            )}
          </Form.List>
        </Card>

        {/* Weight Reminder */}
        <Card title="Weight Reminder" style={{ marginBottom: '24px' }}>
          <Row gutter={16} align="middle">
            <Col span={4}>
              <Text strong>Enabled</Text>
            </Col>
            <Col span={4}>
              <Form.Item name={['weight_reminder', 'enabled']} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['weight_reminder', 'time']} label="Time">
                <TimePicker 
                  format="HH:mm" 
                  style={{ width: '100%' }} 
                  minuteStep={15}
                  showNow={false}
                  disabledMinutes={disabledMinutes}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['weight_reminder', 'reminder_interval_days']} label="Interval (days)">
                <InputNumber min={1} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Summary Reminder */}
        <Card title="Daily Summary" style={{ marginBottom: '24px' }}>
          <Row gutter={16} align="middle">
            <Col span={4}>
              <Text strong>Enabled</Text>
            </Col>
            <Col span={4}>
              <Form.Item name={['summary_reminder', 'enabled']} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['summary_reminder', 'time']} label="Time">
                <TimePicker 
                  format="HH:mm" 
                  style={{ width: '100%' }} 
                  minuteStep={15}
                  showNow={false}
                  disabledMinutes={disabledMinutes}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            icon={<SaveOutlined />}
            loading={saving}
            size="large"
            style={{
              borderRadius: '8px',
              fontSize: '16px',
              height: '48px',
              minWidth: '200px',
              fontWeight: '600'
            }}
          >
            Save Reminder Settings
          </Button>
        </div>
      </Form>
      
      <style jsx>{`
        @media (max-width: 768px) {
          .ant-card-body {
            padding: 16px !important;
          }
          
          .ant-form-item-label > label {
            font-size: 14px !important;
            font-weight: 500 !important;
          }
          
          .ant-input,
          .ant-select-selector,
          .ant-picker {
            font-size: 16px !important;
            height: 44px !important;
          }
          
          .ant-btn {
            height: 44px !important;
            font-size: 16px !important;
            border-radius: 8px !important;
          }
          
          .ant-switch {
            transform: scale(1.1);
          }
        }
        
        @media (max-width: 576px) {
          .ant-card-body {
            padding: 12px !important;
          }
          
          .ant-form-item {
            margin-bottom: 12px !important;
          }
          
          .ant-input,
          .ant-select-selector,
          .ant-picker {
            font-size: 16px !important;
            height: 48px !important;
          }
          
          .ant-btn {
            height: 48px !important;
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ReminderSettings;
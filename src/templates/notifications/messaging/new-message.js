/**
 * New Message Notification Template
 */

module.exports = {
  templateKey: 'messaging_new_message',
  name: 'New Message',
  description: 'Notification sent when a new message is received',
  category: 'messaging',
  priority: 'normal',
  
  // Email templates
  emailSubject: 'New message from {{senderName}} on LegacyLancers',
  emailHtmlTemplate: `
    <h2>You have a new message</h2>
    <p>Hello {{recipientName}},</p>
    <p>You've received a new message from <strong>{{senderName}}</strong>.</p>
    
    <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        {{#if senderAvatarUrl}}
        <img src="{{senderAvatarUrl}}" alt="{{senderName}}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">
        {{/if}}
        <div>
          <strong style="color: #007bff;">{{senderName}}</strong>
          {{#if senderTitle}}<br><small style="color: #666;">{{senderTitle}}</small>{{/if}}
        </div>
      </div>
      
      <div style="background-color: white; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;">
        {{#if subject}}<h4 style="margin-top: 0; color: #495057;">{{subject}}</h4>{{/if}}
        <p style="margin-bottom: 0; line-height: 1.5;">{{messagePreview}}...</p>
      </div>
      
      <small style="color: #666; margin-top: 10px; display: block;">
        {{sentAt}} • {{#if conversationTitle}}{{conversationTitle}}{{else}}Direct Message{{/if}}
      </small>
    </div>
    
    {{#if attachmentCount}}
    <p style="color: #666;">
      📎 This message includes {{attachmentCount}} attachment{{#if_gt attachmentCount 1}}s{{/if_gt}}.
    </p>
    {{/if}}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{messageUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">Reply to Message</a>
      <a href="{{conversationUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">View Conversation</a>
    </div>
    
    {{#if relatedBooking}}
    <div style="background-color: #e7f3ff; border: 1px solid #b8daff; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h4 style="margin-top: 0; color: #004085;">Related Booking</h4>
      <p style="margin-bottom: 0;">
        <strong>{{relatedBooking.serviceType}}</strong><br>
        {{relatedBooking.scheduledDate}} • {{relatedBooking.status}}
      </p>
    </div>
    {{/if}}
    
    <p style="color: #666; font-size: 14px;">
      <strong>Sender Profile:</strong> <a href="{{senderProfileUrl}}">{{senderName}}</a><br>
      {{#if senderCompany}}<strong>Company:</strong> {{senderCompany}}<br>{{/if}}
      <strong>Response Rate:</strong> {{senderResponseRate}}%
    </p>
  `,
  
  emailTextTemplate: `
You have a new message

Hello {{recipientName}},

You've received a new message from {{senderName}}.

{{#if subject}}
SUBJECT: {{subject}}
{{/if}}

MESSAGE PREVIEW:
"{{messagePreview}}..."

{{#if attachmentCount}}
📎 This message includes {{attachmentCount}} attachment{{#if_gt attachmentCount 1}}s{{/if_gt}}.
{{/if}}

Sent: {{sentAt}}
{{#if conversationTitle}}
Conversation: {{conversationTitle}}
{{else}}
Type: Direct Message
{{/if}}

{{#if relatedBooking}}
RELATED BOOKING:
{{relatedBooking.serviceType}} - {{relatedBooking.scheduledDate}} ({{relatedBooking.status}})
{{/if}}

Reply to this message: {{messageUrl}}
View full conversation: {{conversationUrl}}

SENDER PROFILE:
{{senderName}} - {{senderProfileUrl}}
{{#if senderCompany}}
Company: {{senderCompany}}
{{/if}}
Response Rate: {{senderResponseRate}}%

© 2025 LegacyLancers. All rights reserved.
  `,
  
  // In-app template
  inAppTemplate: `New message from {{senderName}}: "{{messagePreview}}"{{#if subject}} - {{subject}}{{/if}}`,
  
  // SMS template
  smsTemplate: `LegacyLancers: New message from {{senderName}}. Reply: {{shortMessageUrl}}`,
  
  // Template variables
  templateVariables: [
    'recipientName',
    'senderName',
    'senderTitle',
    'senderCompany',
    'senderAvatarUrl',
    'senderProfileUrl',
    'senderResponseRate',
    'subject',
    'messagePreview',
    'attachmentCount',
    'sentAt',
    'conversationTitle',
    'messageUrl',
    'shortMessageUrl',
    'conversationUrl',
    'relatedBooking'
  ],
  
  // Channel support
  supportsEmail: true,
  supportsInApp: true,
  supportsSms: true
};
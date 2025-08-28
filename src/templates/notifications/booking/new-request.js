/**
 * New Booking Request Notification Template
 */

module.exports = {
  templateKey: 'booking_new_request',
  name: 'New Booking Request',
  description: 'Notification sent when a new booking request is received',
  category: 'booking',
  priority: 'high',
  
  // Email templates
  emailSubject: 'New booking request on LegacyLancers',
  emailHtmlTemplate: `
    <h2>You have a new booking request!</h2>
    <p>Hello {{recipientName}},</p>
    <p><strong>{{clientName}}</strong> has requested to book you for <strong>{{serviceType}}</strong>.</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #007bff;">Booking Details:</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li><strong>Service:</strong> {{serviceType}}</li>
        <li><strong>Duration:</strong> {{duration}}</li>
        <li><strong>Proposed Date:</strong> {{proposedDate}}</li>
        <li><strong>Budget:</strong> {{budget}}</li>
        {{#if location}}<li><strong>Location:</strong> {{location}}</li>{{/if}}
        {{#if isRemote}}<li><strong>Remote Session:</strong> Yes</li>{{/if}}
      </ul>
      
      {{#if message}}
      <p style="margin-top: 15px;"><strong>Client Message:</strong></p>
      <blockquote style="border-left: 3px solid #007bff; padding-left: 15px; margin: 10px 0; color: #666;">
        {{message}}
      </blockquote>
      {{/if}}
    </div>
    
    <p><strong>What's next?</strong></p>
    <p>Review the request details and respond within 48 hours to maintain your response rate.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{bookingUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">Accept Request</a>
      <a href="{{bookingUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">View Details</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      <strong>Client Profile:</strong> <a href="{{clientProfileUrl}}">{{clientName}}</a><br>
      {{#if clientCompany}}<strong>Company:</strong> {{clientCompany}}<br>{{/if}}
      <strong>Member since:</strong> {{clientMemberSince}}
    </p>
  `,
  
  emailTextTemplate: `
You have a new booking request!

Hello {{recipientName}},

{{clientName}} has requested to book you for {{serviceType}}.

BOOKING DETAILS:
- Service: {{serviceType}}
- Duration: {{duration}}
- Proposed Date: {{proposedDate}}
- Budget: {{budget}}
{{#if location}}
- Location: {{location}}
{{/if}}
{{#if isRemote}}
- Remote Session: Yes
{{/if}}

{{#if message}}
CLIENT MESSAGE:
"{{message}}"
{{/if}}

WHAT'S NEXT?
Review the request details and respond within 48 hours to maintain your response rate.

View and respond to this booking request: {{bookingUrl}}

CLIENT PROFILE:
{{clientName}} - {{clientProfileUrl}}
{{#if clientCompany}}
Company: {{clientCompany}}
{{/if}}
Member since: {{clientMemberSince}}

© 2025 LegacyLancers. All rights reserved.
  `,
  
  // In-app template
  inAppTemplate: `New booking request from {{clientName}} for {{serviceType}} on {{proposedDate}}. Budget: {{budget}}. Respond within 48 hours to maintain your response rate.`,
  
  // SMS template
  smsTemplate: `LegacyLancers: New booking request from {{clientName}} for {{serviceType}} on {{proposedDate}}. View details: {{shortBookingUrl}}`,
  
  // Template variables
  templateVariables: [
    'recipientName',
    'clientName', 
    'clientCompany',
    'clientProfileUrl',
    'clientMemberSince',
    'serviceType',
    'duration',
    'proposedDate',
    'budget',
    'location',
    'isRemote',
    'message',
    'bookingUrl',
    'shortBookingUrl'
  ],
  
  // Channel support
  supportsEmail: true,
  supportsInApp: true,
  supportsSms: true
};
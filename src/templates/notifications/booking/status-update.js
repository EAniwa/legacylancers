/**
 * Booking Status Update Notification Template
 */

module.exports = {
  templateKey: 'booking_status_update',
  name: 'Booking Status Update',
  description: 'Notification sent when booking status changes',
  category: 'booking',
  priority: 'high',
  
  // Email templates
  emailSubject: 'Booking {{status}} - {{serviceType}}',
  emailHtmlTemplate: `
    <h2>Your booking has been {{status}}</h2>
    <p>Hello {{recipientName}},</p>
    
    {{#if_eq status "accepted"}}
    <p>Great news! <strong>{{providerName}}</strong> has accepted your booking request for <strong>{{serviceType}}</strong>.</p>
    
    <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #155724;">🎉 Booking Confirmed!</h3>
      <p style="margin-bottom: 0; color: #155724;">Your session is now scheduled and confirmed.</p>
    </div>
    {{/if_eq}}
    
    {{#if_eq status "declined"}}
    <p>Unfortunately, <strong>{{providerName}}</strong> was unable to accept your booking request for <strong>{{serviceType}}</strong>.</p>
    
    <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #721c24;">Booking Declined</h3>
      <p style="margin-bottom: 0; color: #721c24;">Don't worry - there are other skilled professionals available!</p>
    </div>
    {{/if_eq}}
    
    {{#if_eq status "completed"}}
    <p>Your session with <strong>{{providerName}}</strong> for <strong>{{serviceType}}</strong> has been marked as completed.</p>
    
    <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #0c5460;">✅ Session Complete!</h3>
      <p style="margin-bottom: 0; color: #0c5460;">Please take a moment to leave a review.</p>
    </div>
    {{/if_eq}}
    
    {{#if_eq status "cancelled"}}
    <p>Your booking with <strong>{{providerName}}</strong> for <strong>{{serviceType}}</strong> has been cancelled.</p>
    
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #856404;">Booking Cancelled</h3>
      {{#if reason}}<p style="margin-bottom: 0; color: #856404;"><strong>Reason:</strong> {{reason}}</p>{{/if}}
    </div>
    {{/if_eq}}
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #007bff;">Booking Details:</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li><strong>Service:</strong> {{serviceType}}</li>
        <li><strong>Date & Time:</strong> {{scheduledDate}} at {{scheduledTime}}</li>
        <li><strong>Duration:</strong> {{duration}}</li>
        <li><strong>Total Cost:</strong> {{totalCost}}</li>
        {{#if location}}<li><strong>Location:</strong> {{location}}</li>{{/if}}
        {{#if meetingLink}}<li><strong>Meeting Link:</strong> <a href="{{meetingLink}}">Join Session</a></li>{{/if}}
      </ul>
    </div>
    
    {{#if providerMessage}}
    <div style="background-color: #fff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
      <h4 style="margin-top: 0;">Message from {{providerName}}:</h4>
      <p style="margin-bottom: 0; color: #666;">{{providerMessage}}</p>
    </div>
    {{/if}}
    
    <div style="text-align: center; margin: 30px 0;">
      {{#if_eq status "accepted"}}
      <a href="{{bookingUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">View Booking</a>
      {{#if meetingLink}}
      <a href="{{meetingLink}}" style="display: inline-block; padding: 12px 30px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">Join Session</a>
      {{/if}}
      {{/if_eq}}
      
      {{#if_eq status "completed"}}
      <a href="{{reviewUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #ffc107; color: #000; text-decoration: none; border-radius: 5px; margin: 5px;">Leave Review</a>
      <a href="{{bookingUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">View Details</a>
      {{/if_eq}}
      
      {{#if_eq status "declined"}}
      <a href="{{searchUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">Find Alternative</a>
      {{/if_eq}}
      
      {{#if_eq status "cancelled"}}
      <a href="{{searchUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">Book Another</a>
      {{/if_eq}}
    </div>
  `,
  
  emailTextTemplate: `
Your booking has been {{status}}

Hello {{recipientName}},

{{#if_eq status "accepted"}}
Great news! {{providerName}} has accepted your booking request for {{serviceType}}.

🎉 BOOKING CONFIRMED!
Your session is now scheduled and confirmed.
{{/if_eq}}

{{#if_eq status "declined"}}
Unfortunately, {{providerName}} was unable to accept your booking request for {{serviceType}}.

Don't worry - there are other skilled professionals available!
{{/if_eq}}

{{#if_eq status "completed"}}
Your session with {{providerName}} for {{serviceType}} has been marked as completed.

✅ SESSION COMPLETE!
Please take a moment to leave a review.
{{/if_eq}}

{{#if_eq status "cancelled"}}
Your booking with {{providerName}} for {{serviceType}} has been cancelled.
{{#if reason}}
Reason: {{reason}}
{{/if}}
{{/if_eq}}

BOOKING DETAILS:
- Service: {{serviceType}}
- Date & Time: {{scheduledDate}} at {{scheduledTime}}
- Duration: {{duration}}
- Total Cost: {{totalCost}}
{{#if location}}
- Location: {{location}}
{{/if}}
{{#if meetingLink}}
- Meeting Link: {{meetingLink}}
{{/if}}

{{#if providerMessage}}
MESSAGE FROM {{providerName}}:
"{{providerMessage}}"
{{/if}}

View booking details: {{bookingUrl}}

© 2025 LegacyLancers. All rights reserved.
  `,
  
  // In-app template
  inAppTemplate: `Booking {{status}}: {{serviceType}} with {{providerName}} on {{scheduledDate}}. {{#if_eq status "accepted"}}Session confirmed!{{/if_eq}}{{#if_eq status "completed"}}Please leave a review.{{/if_eq}}`,
  
  // SMS template
  smsTemplate: `LegacyLancers: Booking {{status}} - {{serviceType}} on {{scheduledDate}}. Details: {{shortBookingUrl}}`,
  
  // Template variables
  templateVariables: [
    'recipientName',
    'providerName',
    'serviceType',
    'status',
    'scheduledDate',
    'scheduledTime',
    'duration',
    'totalCost',
    'location',
    'meetingLink',
    'providerMessage',
    'reason',
    'bookingUrl',
    'shortBookingUrl',
    'reviewUrl',
    'searchUrl'
  ],
  
  // Channel support
  supportsEmail: true,
  supportsInApp: true,
  supportsSms: true
};
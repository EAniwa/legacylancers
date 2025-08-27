/**
 * Security Alert Notification Template
 */

module.exports = {
  templateKey: 'system_security_alert',
  name: 'Security Alert',
  description: 'Security-related notifications for account protection',
  category: 'system',
  priority: 'urgent',
  
  // Email templates
  emailSubject: '🔒 Security Alert - {{alertType}} on your LegacyLancers account',
  emailHtmlTemplate: `
    <div style="background-color: #721c24; color: white; padding: 20px; text-align: center; margin-bottom: 20px;">
      <h1 style="margin: 0; color: white;">🔒 Security Alert</h1>
    </div>
    
    <p>Hello {{recipientName}},</p>
    
    <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h2 style="margin-top: 0; color: #721c24;">⚠️ Important Security Notice</h2>
      <p style="margin-bottom: 0; color: #721c24;">
        We detected {{alertType}} on your LegacyLancers account.
      </p>
    </div>
    
    <div style="background-color: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #495057;">Alert Details:</h3>
      <ul style="margin-bottom: 0; padding-left: 20px;">
        <li><strong>Event:</strong> {{alertType}}</li>
        <li><strong>Date & Time:</strong> {{eventDateTime}}</li>
        <li><strong>Location:</strong> {{location}}</li>
        <li><strong>IP Address:</strong> {{ipAddress}}</li>
        <li><strong>Device:</strong> {{deviceInfo}}</li>
        {{#if browserInfo}}<li><strong>Browser:</strong> {{browserInfo}}</li>{{/if}}
      </ul>
    </div>
    
    {{#if_eq alertType "suspicious_login"}}
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h4 style="margin-top: 0; color: #856404;">Was this you?</h4>
      <p style="color: #856404; margin-bottom: 15px;">
        If you recognize this activity, no further action is needed. If you don't recognize this activity, 
        your account may have been compromised.
      </p>
      <div style="text-align: center;">
        <a href="{{secureAccountUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">Secure My Account</a>
        <a href="{{changePasswordUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #ffc107; color: #000; text-decoration: none; border-radius: 5px; margin: 5px;">Change Password</a>
      </div>
    </div>
    {{/if_eq}}
    
    {{#if_eq alertType "password_changed"}}
    <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h4 style="margin-top: 0; color: #155724;">Password Changed Successfully</h4>
      <p style="color: #155724; margin-bottom: 0;">
        Your account password was successfully changed. If you did not make this change, 
        please contact our security team immediately.
      </p>
    </div>
    {{/if_eq}}
    
    {{#if_eq alertType "account_locked"}}
    <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h4 style="margin-top: 0; color: #721c24;">Account Temporarily Locked</h4>
      <p style="color: #721c24; margin-bottom: 15px;">
        Your account has been temporarily locked due to multiple failed login attempts. 
        This is a security measure to protect your account.
      </p>
      <div style="text-align: center;">
        <a href="{{unlockAccountUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">Unlock Account</a>
      </div>
    </div>
    {{/if_eq}}
    
    {{#if_eq alertType "new_device_login"}}
    <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h4 style="margin-top: 0; color: #0c5460;">New Device Login</h4>
      <p style="color: #0c5460; margin-bottom: 15px;">
        We noticed you signed in from a new device. If this was you, you can ignore this message.
      </p>
      <div style="text-align: center;">
        <a href="{{manageDevicesUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #17a2b8; color: white; text-decoration: none; border-radius: 5px; margin: 5px;">Manage Devices</a>
      </div>
    </div>
    {{/if_eq}}
    
    <div style="background-color: #e7f3ff; border: 1px solid #b8daff; padding: 20px; border-radius: 5px; margin: 25px 0;">
      <h3 style="margin-top: 0; color: #004085;">🛡️ Recommended Security Actions</h3>
      <ul style="margin-bottom: 0; padding-left: 20px; color: #004085;">
        <li><strong>Use a strong, unique password</strong> for your LegacyLancers account</li>
        <li><strong>Enable two-factor authentication</strong> for extra security</li>
        <li><strong>Keep your contact information updated</strong> so we can reach you</li>
        <li><strong>Be cautious of phishing emails</strong> - we'll never ask for your password</li>
        <li><strong>Log out from shared devices</strong> and public computers</li>
      </ul>
    </div>
    
    {{#if requiresAction}}
    <div style="background-color: #721c24; color: white; padding: 20px; text-align: center; border-radius: 5px; margin: 25px 0;">
      <h3 style="margin: 0; color: white;">⚡ Immediate Action Required</h3>
      <p style="margin: 10px 0; color: white;">{{actionRequired}}</p>
      <a href="{{actionUrl}}" style="display: inline-block; padding: 15px 30px; background-color: white; color: #721c24; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Take Action Now</a>
    </div>
    {{/if}}
    
    <div style="border-top: 2px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
      <p style="color: #666; font-size: 14px;">
        <strong>Need help?</strong> Our security team is available 24/7.<br>
        📧 <a href="mailto:{{securityEmail}}">{{securityEmail}}</a> | 
        📞 {{securityPhone}} | 
        💬 <a href="{{securityChatUrl}}">Emergency Chat</a>
      </p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="margin: 0; font-size: 12px; color: #666;">
          <strong>Important:</strong> LegacyLancers will never ask you to share your password, 
          verification codes, or sensitive account information via email or phone. If someone 
          claiming to be from LegacyLancers asks for this information, do not provide it and 
          contact us immediately.
        </p>
      </div>
    </div>
    
    <p>Stay safe,<br>
    The LegacyLancers Security Team</p>
  `,
  
  emailTextTemplate: `
🔒 SECURITY ALERT

Hello {{recipientName}},

⚠️ IMPORTANT SECURITY NOTICE
We detected {{alertType}} on your LegacyLancers account.

ALERT DETAILS:
- Event: {{alertType}}
- Date & Time: {{eventDateTime}}
- Location: {{location}}
- IP Address: {{ipAddress}}
- Device: {{deviceInfo}}
{{#if browserInfo}}
- Browser: {{browserInfo}}
{{/if}}

{{#if_eq alertType "suspicious_login"}}
WAS THIS YOU?
If you recognize this activity, no further action is needed. If you don't recognize this activity, your account may have been compromised.

Secure your account: {{secureAccountUrl}}
Change password: {{changePasswordUrl}}
{{/if_eq}}

{{#if_eq alertType "password_changed"}}
PASSWORD CHANGED SUCCESSFULLY
Your account password was successfully changed. If you did not make this change, please contact our security team immediately.
{{/if_eq}}

{{#if_eq alertType "account_locked"}}
ACCOUNT TEMPORARILY LOCKED
Your account has been temporarily locked due to multiple failed login attempts. This is a security measure to protect your account.

Unlock account: {{unlockAccountUrl}}
{{/if_eq}}

{{#if_eq alertType "new_device_login"}}
NEW DEVICE LOGIN
We noticed you signed in from a new device. If this was you, you can ignore this message.

Manage devices: {{manageDevicesUrl}}
{{/if_eq}}

🛡️ RECOMMENDED SECURITY ACTIONS:
• Use a strong, unique password for your LegacyLancers account
• Enable two-factor authentication for extra security
• Keep your contact information updated so we can reach you
• Be cautious of phishing emails - we'll never ask for your password
• Log out from shared devices and public computers

{{#if requiresAction}}
⚡ IMMEDIATE ACTION REQUIRED
{{actionRequired}}

Take action now: {{actionUrl}}
{{/if}}

NEED HELP?
Our security team is available 24/7.
📧 {{securityEmail}}
📞 {{securityPhone}}
💬 Emergency Chat: {{securityChatUrl}}

IMPORTANT: LegacyLancers will never ask you to share your password, verification codes, or sensitive account information via email or phone. If someone claiming to be from LegacyLancers asks for this information, do not provide it and contact us immediately.

Stay safe,
The LegacyLancers Security Team

© 2025 LegacyLancers. All rights reserved.
  `,
  
  // In-app template
  inAppTemplate: `🔒 Security Alert: {{alertType}} detected on your account from {{location}} at {{eventDateTime}}. {{#if requiresAction}}Immediate action required.{{/if}}`,
  
  // SMS template
  smsTemplate: `SECURITY ALERT: {{alertType}} on your LegacyLancers account. {{#if requiresAction}}Action required:{{/if}} {{actionUrl}}`,
  
  // Template variables
  templateVariables: [
    'recipientName',
    'alertType',
    'eventDateTime',
    'location',
    'ipAddress',
    'deviceInfo',
    'browserInfo',
    'secureAccountUrl',
    'changePasswordUrl',
    'unlockAccountUrl',
    'manageDevicesUrl',
    'requiresAction',
    'actionRequired',
    'actionUrl',
    'securityEmail',
    'securityPhone',
    'securityChatUrl'
  ],
  
  // Channel support
  supportsEmail: true,
  supportsInApp: true,
  supportsSms: true
};
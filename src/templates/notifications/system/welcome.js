/**
 * Welcome Notification Template
 */

module.exports = {
  templateKey: 'system_welcome',
  name: 'Welcome to LegacyLancers',
  description: 'Welcome notification for new users',
  category: 'system',
  priority: 'normal',
  
  // Email templates
  emailSubject: 'Welcome to LegacyLancers, {{recipientName}}!',
  emailHtmlTemplate: `
    <h1 style="color: #007bff;">Welcome to LegacyLancers!</h1>
    <p>Hello {{recipientName}},</p>
    <p>Welcome to LegacyLancers, the premier platform connecting experienced professionals with organizations that value expertise and wisdom.</p>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 25px 0;">
      <h2 style="margin-top: 0; color: #28a745;">🎉 You're all set to get started!</h2>
      <p>Your professional journey on LegacyLancers begins now. Here's what you can do next:</p>
    </div>
    
    <div style="margin: 30px 0;">
      <div style="border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; background-color: #f8f9fa;">
        <h3 style="margin-top: 0; color: #007bff;">1. Complete Your Profile</h3>
        <p style="margin-bottom: 0;">Showcase your experience, skills, and expertise to attract the right opportunities.</p>
        <a href="{{profileUrl}}" style="color: #007bff; text-decoration: none; font-weight: bold;">Complete Profile →</a>
      </div>
      
      <div style="border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; background-color: #f8f9fa;">
        <h3 style="margin-top: 0; color: #28a745;">2. Set Your Availability</h3>
        <p style="margin-bottom: 0;">Let clients know when you're available and what types of engagements you prefer.</p>
        <a href="{{availabilityUrl}}" style="color: #28a745; text-decoration: none; font-weight: bold;">Set Availability →</a>
      </div>
      
      <div style="border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; background-color: #f8f9fa;">
        <h3 style="margin-top: 0; color: #856404;">3. Explore Opportunities</h3>
        <p style="margin-bottom: 0;">Browse projects and consulting opportunities that match your expertise.</p>
        <a href="{{opportunitiesUrl}}" style="color: #856404; text-decoration: none; font-weight: bold;">Browse Opportunities →</a>
      </div>
    </div>
    
    <div style="background-color: #e7f3ff; border: 1px solid #b8daff; padding: 20px; border-radius: 5px; margin: 25px 0;">
      <h3 style="margin-top: 0; color: #004085;">💡 What makes LegacyLancers special?</h3>
      <ul style="margin-bottom: 0; padding-left: 20px;">
        <li><strong>Experience Valued:</strong> Your years of expertise are your greatest asset</li>
        <li><strong>Flexible Engagements:</strong> From consulting to mentoring to speaking engagements</li>
        <li><strong>Quality Connections:</strong> Work with organizations that appreciate seasoned professionals</li>
        <li><strong>Fair Compensation:</strong> Set your own rates and terms</li>
        <li><strong>Supportive Community:</strong> Connect with like-minded professionals</li>
      </ul>
    </div>
    
    {{#if onboardingTasks}}
    <div style="margin: 25px 0;">
      <h3 style="color: #007bff;">📋 Complete Your Onboarding</h3>
      <div style="background-color: #fff; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px;">
        {{#each onboardingTasks}}
        <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f8f9fa;">
          <span style="margin-right: 10px;">{{#if completed}}✅{{else}}⏳{{/if}}</span>
          <span style="flex: 1;">{{taskName}}</span>
          {{#unless completed}}
          <a href="{{taskUrl}}" style="color: #007bff; text-decoration: none; font-size: 14px;">Complete →</a>
          {{/unless}}
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="{{dashboardUrl}}" style="display: inline-block; padding: 15px 35px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Go to Dashboard</a>
    </div>
    
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 25px 0;">
      <h4 style="margin-top: 0; color: #856404;">Need Help Getting Started?</h4>
      <p style="margin-bottom: 10px;">Our support team is here to help you make the most of LegacyLancers.</p>
      <p style="margin-bottom: 0;">
        📧 <a href="mailto:{{supportEmail}}">{{supportEmail}}</a> | 
        📚 <a href="{{helpCenterUrl}}">Help Center</a> | 
        💬 <a href="{{chatUrl}}">Live Chat</a>
      </p>
    </div>
    
    <p>We're excited to have you join our community of experienced professionals making a meaningful impact!</p>
    
    <p>Best regards,<br>
    The LegacyLancers Team</p>
  `,
  
  emailTextTemplate: `
Welcome to LegacyLancers!

Hello {{recipientName}},

Welcome to LegacyLancers, the premier platform connecting experienced professionals with organizations that value expertise and wisdom.

🎉 YOU'RE ALL SET TO GET STARTED!

Your professional journey on LegacyLancers begins now. Here's what you can do next:

1. COMPLETE YOUR PROFILE
   Showcase your experience, skills, and expertise to attract the right opportunities.
   → {{profileUrl}}

2. SET YOUR AVAILABILITY  
   Let clients know when you're available and what types of engagements you prefer.
   → {{availabilityUrl}}

3. EXPLORE OPPORTUNITIES
   Browse projects and consulting opportunities that match your expertise.
   → {{opportunitiesUrl}}

💡 WHAT MAKES LEGACYLANCERS SPECIAL?
• Experience Valued: Your years of expertise are your greatest asset
• Flexible Engagements: From consulting to mentoring to speaking engagements  
• Quality Connections: Work with organizations that appreciate seasoned professionals
• Fair Compensation: Set your own rates and terms
• Supportive Community: Connect with like-minded professionals

{{#if onboardingTasks}}
📋 COMPLETE YOUR ONBOARDING:
{{#each onboardingTasks}}
{{#if completed}}✅{{else}}⏳{{/if}} {{taskName}}{{#unless completed}} - {{taskUrl}}{{/unless}}
{{/each}}
{{/if}}

Go to your dashboard: {{dashboardUrl}}

NEED HELP GETTING STARTED?
Our support team is here to help you make the most of LegacyLancers.

📧 {{supportEmail}}
📚 Help Center: {{helpCenterUrl}}  
💬 Live Chat: {{chatUrl}}

We're excited to have you join our community of experienced professionals making a meaningful impact!

Best regards,
The LegacyLancers Team

© 2025 LegacyLancers. All rights reserved.
  `,
  
  // In-app template
  inAppTemplate: `Welcome to LegacyLancers, {{recipientName}}! Complete your profile to start connecting with opportunities that value your expertise.`,
  
  // SMS template
  smsTemplate: `Welcome to LegacyLancers! Complete your setup: {{shortDashboardUrl}}`,
  
  // Template variables
  templateVariables: [
    'recipientName',
    'profileUrl',
    'availabilityUrl', 
    'opportunitiesUrl',
    'dashboardUrl',
    'shortDashboardUrl',
    'supportEmail',
    'helpCenterUrl',
    'chatUrl',
    'onboardingTasks'
  ],
  
  // Channel support
  supportsEmail: true,
  supportsInApp: true,
  supportsSms: true
};
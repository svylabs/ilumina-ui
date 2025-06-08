import nodemailer from 'nodemailer';
import { SelectUser } from '@db/schema';

// Email configuration
const createTransporter = (isNoReply = false) => {
  const user = isNoReply ? process.env.NOREPLY_EMAIL : process.env.SMTP_USER;
  const pass = isNoReply ? process.env.NOREPLY_PASS : process.env.SMTP_PASS;
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
};

// Email templates
const getWelcomeEmailTemplate = (user: SelectUser) => {
  return {
    subject: 'Welcome to Ilumina - Your Smart Contract Analysis Journey Begins!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
          .features { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .feature { margin-bottom: 15px; }
          .feature strong { color: #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Ilumina!</h1>
            <p>Your AI-powered smart contract analysis platform</p>
          </div>
          <div class="content">
            <h2>Hello ${user.name || user.email}!</h2>
            
            <p>Thank you for joining Ilumina! You're now ready to revolutionize how you analyze and test smart contracts.</p>
            
            <div class="features">
              <h3>What you can do with Ilumina:</h3>
              <div class="feature">
                <strong>🔍 Comprehensive Analysis:</strong> Our 9-step pipeline analyzes your smart contracts, identifies actors, and creates deployment strategies.
              </div>
              <div class="feature">
                <strong>🚀 Automated Simulations:</strong> Built on @svylabs/ilumina framework, we generate TypeScript simulation repositories for thorough testing.
              </div>
              <div class="feature">
                <strong>🤖 AI Assistant:</strong> Get personalized guidance throughout your analysis journey with our intelligent chatbot.
              </div>
              <div class="feature">
                <strong>📊 Validation & Testing:</strong> Snapshots validate contract state changes during action execution.
              </div>
            </div>
            
            <p><strong>Your Free Plan includes:</strong></p>
            <ul>
              <li>1 repository analysis</li>
              <li>10 AI assistant credits per month</li>
              <li>Access to the complete 9-step analysis pipeline</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}" class="button">Start Your First Analysis</a>
            </div>
            
            <p>Need help getting started? Our AI assistant is ready to guide you through every step of the process.</p>
            
            <p>Best regards,<br>
            The Ilumina Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to Ilumina!
    
Hello ${user.name || user.email}!

Thank you for joining Ilumina! You're now ready to revolutionize how you analyze and test smart contracts.

What you can do with Ilumina:
- Comprehensive Analysis: Our 9-step pipeline analyzes your smart contracts, identifies actors, and creates deployment strategies
- Automated Simulations: Built on @svylabs/ilumina framework, we generate TypeScript simulation repositories for thorough testing
- AI Assistant: Get personalized guidance throughout your analysis journey with our intelligent chatbot
- Validation & Testing: Snapshots validate contract state changes during action execution

Your Free Plan includes:
- 1 repository analysis
- 10 AI assistant credits per month
- Access to the complete 9-step analysis pipeline

Get started: ${process.env.FRONTEND_URL || 'http://localhost:5000'}

Need help getting started? Our AI assistant is ready to guide you through every step of the process.

Best regards,
The Ilumina Team`
  };
};

const getPasswordResetEmailTemplate = (user: SelectUser, resetToken: string) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  
  return {
    subject: 'Reset Your Ilumina Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name || user.email}!</h2>
            
            <p>You requested to reset your password for your Ilumina account. Click the button below to set a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>Security Notice:</strong> This link will expire in 1 hour for your security. If you didn't request this reset, please ignore this email.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            
            <p>If you didn't request this password reset, please contact our support team.</p>
            
            <p>Best regards,<br>
            The Ilumina Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Password Reset Request

Hello ${user.name || user.email}!

You requested to reset your password for your Ilumina account.

Reset your password: ${resetUrl}

This link will expire in 1 hour for your security. If you didn't request this reset, please ignore this email.

If you didn't request this password reset, please contact our support team.

Best regards,
The Ilumina Team`
  };
};

// Email sending functions
export const sendWelcomeEmail = async (user: SelectUser): Promise<boolean> => {
  try {
    const transporter = createTransporter(false); // Use sridhar@ilumina.dev
    const emailTemplate = getWelcomeEmailTemplate(user);
    
    await transporter.sendMail({
      from: `"Ilumina Team" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });
    
    console.log(`Welcome email sent successfully to ${user.email}`);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

export const sendPasswordResetEmail = async (user: SelectUser, resetToken: string): Promise<boolean> => {
  try {
    const transporter = createTransporter(true); // Use noreply@ilumina.dev
    const emailTemplate = getPasswordResetEmailTemplate(user, resetToken);
    
    await transporter.sendMail({
      from: `"Ilumina" <${process.env.NOREPLY_EMAIL}>`,
      to: user.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });
    
    console.log(`Password reset email sent successfully to ${user.email}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

// Test email configuration
export const testEmailConfiguration = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter(false);
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
};
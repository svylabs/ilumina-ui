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
    subject: 'Welcome to Ilumina - Create and Run simulations with ease',
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
            <div style="margin-bottom: 30px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 4px; border-radius: 50%; margin-bottom: 35px; width: 88px; height: 88px;">
                <div style="width: 80px; height: 80px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; color: #667eea; box-sizing: border-box;">
                  SG
                </div>
              </div>
              <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #1a1a1a;">Hello ${user.name || user.email}!</h2>
              <p style="margin: 0; color: #667eea; font-weight: 600; font-size: 16px;">Sridhar G, Founder & CEO of Ilumina</p>
            </div>
            
            <p>Thank you for joining our platform! I'm excited to have you on this journey with Ilumina.</p>
            
            <div class="features">
              <h3>What you can do with Ilumina:</h3>
              <div class="feature">
                <strong>🔍 Simulation Generation:</strong> Built on @svylabs/ilumina framework, we generate TypeScript code for simulations for thorough testing of your smart contracts.
              </div>
              <div class="feature">
                <strong>🚀 Run Simulations on Demand:</strong> Once simulations are created, you can run simulations on demand in the cloud and get access to the dashboard where you can see the report.
              </div>
              <div class="feature">
                <strong>🤖 AI Assistant:</strong> Get personalized guidance throughout your analysis journey with our intelligent chatbot.
              </div>
            </div>
            
            <div style="background: #f8f9ff; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #667eea;">
              <h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 18px;">Your Free Plan includes:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555;">
                <li style="margin-bottom: 8px;"><strong>1 project</strong></li>
                <li style="margin-bottom: 8px;"><strong>10 AI assistant credits per month</strong></li>
                <li style="margin-bottom: 8px;"><strong>Access to the complete analysis pipeline</strong> for creating simulations</li>
                <li style="margin-bottom: 0;"><strong>1 free simulation run per day</strong></li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}" class="button">Start Your First Analysis</a>
            </div>
            
            <p>Need help getting started? Our AI assistant is ready to guide you through every step of the process.</p>
            
            <p>Best regards,<br>
            Sridhar, Founder & CEO<br>
            Ilumina</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to Ilumina!
    
Hello ${user.name || user.email}!

I am Sridhar, Founder and CEO of Ilumina. Thank you for joining our platform!

What you can do with Ilumina:

🔍 Simulation Generation: Built on @svylabs/ilumina framework, we generate TypeScript code for simulations for thorough testing of your smart contracts.

🚀 Run Simulations on Demand: Once simulations are created, you can run simulations on demand in the cloud and get access to the dashboard where you can see the report.

🤖 AI Assistant: Get personalized guidance throughout your analysis journey with our intelligent chatbot.

Your Free Plan includes:
- 1 repository analysis
- 10 AI assistant credits per month
- Access to the complete 9-step analysis pipeline

Get started: ${process.env.FRONTEND_URL || 'http://localhost:5000'}

Need help getting started? Our AI assistant is ready to guide you through every step of the process.

Best regards,
Sridhar, Founder & CEO
Ilumina`
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
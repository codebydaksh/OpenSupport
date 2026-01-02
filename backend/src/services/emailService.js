import { Resend } from 'resend';
import { checkEmailNotificationsAllowed } from './limitService.js';

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const emailFrom = process.env.EMAIL_FROM || 'notifications@opensupport.app';

/**
 * Send notification email to offline visitor
 */
export async function notifyVisitorOffline(visitorEmail, agentName, orgName, messagePreview) {
    if (!resend) {
        console.warn('Resend not configured, skipping email notification');
        return { sent: false, reason: 'not_configured' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: `${orgName} <${emailFrom}>`,
            to: visitorEmail,
            subject: `New reply from ${orgName}`,
            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 16px;">You have a new message</h2>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
            <strong>${agentName}</strong> from ${orgName} replied to your conversation:
          </p>
          <div style="background-color: #f5f5f5; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="color: #1a1a1a; font-size: 15px; margin: 0; white-space: pre-wrap;">${messagePreview}</p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            Click the widget on our website to continue the conversation.
          </p>
        </div>
      `,
            text: `New message from ${agentName} at ${orgName}:\n\n${messagePreview}\n\nVisit our website to continue the conversation.`
        });

        if (error) {
            console.error('Failed to send email:', error);
            return { sent: false, reason: 'send_failed', error: error.message };
        }

        return { sent: true, id: data.id };
    } catch (error) {
        console.error('Email service error:', error);
        return { sent: false, reason: 'service_error', error: error.message };
    }
}

/**
 * Send email notification for agent reply (only if plan allows)
 */
export async function sendAgentReplyNotification({
    plan,
    visitorEmail,
    agentName,
    orgName,
    messageContent
}) {
    // Check plan allows email notifications
    if (!checkEmailNotificationsAllowed(plan)) {
        return { sent: false, reason: 'plan_not_allowed' };
    }

    // Visitor must have email
    if (!visitorEmail) {
        return { sent: false, reason: 'no_visitor_email' };
    }

    // Truncate message for preview
    const preview = messageContent.length > 500
        ? messageContent.substring(0, 500) + '...'
        : messageContent;

    return notifyVisitorOffline(visitorEmail, agentName, orgName, preview);
}

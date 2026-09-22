import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all messages with contact info
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*, contacts(name, phone_number)')
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          insights: 'No conversations to analyze yet.',
          messageCount: 0,
          conversationCount: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group messages by contact
    const conversationsByContact: Record<string, any[]> = {};
    for (const msg of messages) {
      const contactId = msg.contact_id;
      if (!conversationsByContact[contactId]) {
        conversationsByContact[contactId] = [];
      }
      conversationsByContact[contactId].push(msg);
    }

    // Format conversations for analysis
    let conversationsText = '';
    for (const [contactId, msgs] of Object.entries(conversationsByContact)) {
      const contactName = msgs[0]?.contacts?.name || 'Unknown';
      conversationsText += `\n--- Conversation with ${contactName} ---\n`;
      for (const msg of msgs) {
        const role = msg.direction === 'incoming' ? 'Customer' : 'Business';
        conversationsText += `${role}: ${msg.content}\n`;
      }
    }

    const conversationCount = Object.keys(conversationsByContact).length;
    const messageCount = messages.length;

    // Call Lovable AI to analyze
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-pro-preview',
        messages: [
          {
            role: 'system',
            content: `You are an AI analyst helping a business understand their customer conversations. 
Analyze the conversations and provide actionable insights in the following format:

## Common Questions & Topics
List the most frequently asked questions or topics customers bring up.

## Customer Patterns
Identify patterns in how customers communicate, what they need, and when.

## Suggested Responses
For common questions, suggest optimal response templates.

## Improvement Opportunities
Identify areas where the business could improve their responses or service.

## Key Takeaways
Summarize the most important learnings in bullet points.

Keep the analysis concise but comprehensive. Focus on actionable insights that can improve customer service.`
          },
          {
            role: 'user',
            content: `Please analyze these ${messageCount} messages from ${conversationCount} customer conversations:\n${conversationsText}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const insights = aiResponse.choices?.[0]?.message?.content || 'Unable to generate insights.';

    console.log(`Analyzed ${messageCount} messages from ${conversationCount} conversations`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        insights,
        messageCount,
        conversationCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing conversations:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

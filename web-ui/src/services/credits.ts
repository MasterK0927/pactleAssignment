import { apiClient } from './api';
import { getApiUrl } from '../config/api';

interface CreditsResponse {
  buyer_id: string;
  credits: number;
}

interface PurchaseResponse {
  session_id: string;
  checkout_url: string;
  amount: number;
  currency: string;
  buyer_id: string;
  credits_to_add: number;
  status: string;
}

// Main functions using apiClient (handles authentication automatically)
export const getCredits = async (buyerId: string = 'WEB-USER'): Promise<CreditsResponse> => {
  return apiClient.getCredits(buyerId);
};

export const purchaseCredits = async (buyerId: string, credits: number): Promise<PurchaseResponse> => {
  const amount = credits * 10; // 10 INR per credit
  return apiClient.purchaseCredits(buyerId, credits, amount);
};

// Admin/dev utility for setting credits directly
export async function setCredits(buyerId: string, credits: number) {
  // Use apiClient which handles authentication automatically
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const resp = await fetch(getApiUrl('/api/credits/set'), {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ buyer_id: buyerId, credits }),
  });
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ error: 'Failed to set credits' }));
    throw new Error(error.error || 'Failed to set credits');
  }
  return resp.json() as Promise<{ buyer_id: string; credits: number }>;
}

// Helper for completing mock credit purchases
async function completeCreditsPurchase(sessionId: string) {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const resp = await fetch(getApiUrl('/api/credits/purchase/complete'), {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ session_id: sessionId })
  });
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ error: 'Failed to complete credits purchase' }));
    throw new Error(error.error || 'Failed to complete credits purchase');
  }
  return resp.json();
}

async function safeText(resp: Response) {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}

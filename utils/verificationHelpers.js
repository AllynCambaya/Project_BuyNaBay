// utils/verificationHelpers.js
import { supabase } from '../supabase/supabaseClient';

/**
 * Unified function to get verification status from verifications table
 * This is the SINGLE SOURCE OF TRUTH for verification status checks
 * 
 * @param {string} userEmail - User's email address
 * @returns {Promise<{status: string, data: object|null, canSubmit: boolean}>}
 */
export async function getVerificationStatus(userEmail) {
  try {
    if (!userEmail) {
      return { 
        status: 'not_requested', 
        data: null, 
        canSubmit: true 
      };
    }

    // Query verifications table for latest verification
    const { data: verification, error } = await supabase
      .from('verifications')
      .select('*')
      .eq('email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Handle "no rows found" error gracefully
    if (error && error.code === 'PGRST116') {
      return { 
        status: 'not_requested', 
        data: null, 
        canSubmit: true 
      };
    }

    if (error) {
      console.error('Error fetching verification:', error);
      return { 
        status: 'not_requested', 
        data: null, 
        canSubmit: true 
      };
    }

    if (!verification) {
      return { 
        status: 'not_requested', 
        data: null, 
        canSubmit: true 
      };
    }

    // Determine if user can submit a new verification
    const canSubmit = verification.status === 'rejected' || verification.status === 'not_requested';

    return { 
      status: verification.status, 
      data: verification,
      canSubmit 
    };
  } catch (err) {
    console.error('Error in getVerificationStatus:', err);
    return { 
      status: 'not_requested', 
      data: null, 
      canSubmit: true 
    };
  }
}

/**
 * Check if user has a pending verification
 * 
 * @param {string} userEmail - User's email address
 * @returns {Promise<boolean>}
 */
export async function hasPendingVerification(userEmail) {
  try {
    if (!userEmail) return false;

    const { data, error } = await supabase
      .from('verifications')
      .select('id')
      .eq('email', userEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (error && error.code === 'PGRST116') return false;
    if (error) {
      console.error('Error checking pending verification:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error in hasPendingVerification:', err);
    return false;
  }
}

/**
 * Check if user is already verified (approved)
 * 
 * @param {string} userEmail - User's email address
 * @returns {Promise<boolean>}
 */
export async function isUserVerified(userEmail) {
  try {
    if (!userEmail) return false;

    const { data, error } = await supabase
      .from('verifications')
      .select('id')
      .eq('email', userEmail)
      .eq('status', 'approved')
      .maybeSingle();

    if (error && error.code === 'PGRST116') return false;
    if (error) {
      console.error('Error checking verified status:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error in isUserVerified:', err);
    return false;
  }
}
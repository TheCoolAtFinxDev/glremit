import { supabaseClient } from './supabase-client';

describe('supabaseClient', () => {
  it('should work', () => {
    expect(supabaseClient()).toEqual('supabase-client');
  });
});

import { createClient } from '@supabase/supabase-js'

// COPIE O LINK DO SEU PAINEL (Project Settings > API > Project URL)
const supabaseUrl = 'https://sdbquspkhjnrmijvlwbr.supabase.co' 

// COPIE A CHAVE ANON (Project Settings > API > anon public)
const supabaseAnonKey = 'sb_publishable_7zzKp-M2--hfo8a5vzR-rA_s2eFnhmk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
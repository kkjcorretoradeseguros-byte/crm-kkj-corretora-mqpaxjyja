routerAdd('GET', '/backend/v1/public-config', (e) => {
  const supabaseUrl = $os.getenv('VITE_SUPABASE_URL') || ''
  const supabaseAnonKey = $os.getenv('VITE_SUPABASE_ANON_KEY') || ''

  return e.json(200, {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
  })
})

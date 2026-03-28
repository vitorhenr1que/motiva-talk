import { supabaseAdmin } from './src/lib/supabase-admin'

async function testJoin() {
  console.log('Testing join with replyTo:replyToMessageId(*)...')
  const { data, error } = await supabaseAdmin
    .from('Message')
    .select('*, replyTo:replyToMessageId(*)')
    .not('replyToMessageId', 'is', null)
    .limit(1)

  if (error) {
    console.error('JOIN ERROR:', error.message)
    console.error('Hint:', error.hint)
    console.error('Full Error:', error)
  } else {
    console.log('JOIN SUCCESS!')
    console.log('Sample Data:', JSON.stringify(data, null, 2))
  }
}

testJoin()

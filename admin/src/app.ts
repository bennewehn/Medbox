import { auth } from './services/firebase'

await auth.setCustomUserClaims('9Ug0y9I324bcI5Ask9kIfgtzWwB3', {group: 'operator'})

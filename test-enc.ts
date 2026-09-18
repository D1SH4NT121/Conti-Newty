import { CredentialVault } from './src/modules/auth/credential-vault'; 
const s = 'my-secret'; 
const e1 = CredentialVault.encrypt(s); 
const e2 = CredentialVault.encrypt(s); 
console.log(e1 !== e2 ? 'Differs' : 'Same'); 
console.log(CredentialVault.decrypt(e1)); 
console.log(CredentialVault.decrypt(e2));

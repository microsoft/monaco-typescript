import { registerLanguage } from '../_.contribution';

registerLanguage({
	id: 'nemotypescript',
	extensions: ['.nts', '.ntsx'],
	aliases: [],
	mimetypes: ['text/nemotypescript'],
	loader: () => <Promise<any>>import('./typescript')
});

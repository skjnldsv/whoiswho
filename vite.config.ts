import { createAppConfig } from '@nextcloud/vite-config'
import { join } from 'node:path'

export default createAppConfig({
	'main': join(import.meta.dirname, 'src', 'main.ts'),
})

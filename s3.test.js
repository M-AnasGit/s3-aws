const fs = require('fs')
const path = require('path')
const S3 = require('./S3')

const mime = require('mime-types')

describe('S3 Class', () => {
	let s3
	let versionId

	const testFolder = 'examples'
	const testFile = 'dummy_file.txt'
	const upgradedFile = 'dummy_file_upgraded.txt'
	const testFilePath = path.join(__dirname, testFolder, testFile)
	const upgradedFilePath = path.join(__dirname, testFolder, upgradedFile)

	const downloadDir = path.join(__dirname, 'download')
	const downloadPath = path.join(downloadDir, testFile)

	const BUCKET_NAME = 'classobjecttest'

	beforeAll(() => {
		s3 = new S3(
			{
				region: 'eu-north-1',
			},
			false
		)
		fs.mkdirSync(downloadDir, { recursive: true })
	})

	afterAll(() => {
		fs.unlinkSync(downloadDir)
	})

	describe('createFolder', () => {
		test('create folder in the bucket', async () => {
			const response = await s3.createFolder(BUCKET_NAME, 'test_folder')
			expect(response).toBeTruthy()
		})
	})

	describe('deleteFolder', () => {
		test('delete folder', async () => {
			await s3.createFolder(BUCKET_NAME, 'test-folder-to-delete')
			await expect(s3.deleteFolder(BUCKET_NAME, 'test-folder-to-delete')).resolves.not.toThrow()
		})

		test('delete folder that does not exist', async () => {
			await expect(s3.deleteFolder(BUCKET_NAME, 'test-folder-not-existing')).rejects.toThrow('Folder does not exist')
		})
	})

	describe('generatePresignedUploadUrl', () => {
		test('generate pre-signed upload url', async () => {
			const url = await s3.generatePresignedUploadUrl('classobjecttest', `test_folder/${testFile}`)
			expect(url).toContain('https://')
			const fileContent = fs.readFileSync(testFilePath)
			const contentType = mime.lookup(testFilePath) || 'application/octet-stream'

			const response = await fetch(url, {
				method: 'PUT',
				headers: {
					'Content-Type': contentType,
				},
				body: fileContent,
			})

			expect(response.ok).toBe(true)
			expect(response.status).toBe(200)
		})

		test('generate pre-signed upload url for new version', async () => {
			const url = await s3.generatePresignedUploadUrl(BUCKET_NAME, `test_folder/${testFile}`)
			expect(url).toContain('https://')
			const fileContent = fs.readFileSync(upgradedFilePath)
			const contentType = mime.lookup(upgradedFilePath) || 'application/octet-stream'

			const response = await fetch(url, {
				method: 'PUT',
				headers: {
					'Content-Type': contentType,
				},
				body: fileContent,
			})

			expect(response.ok).toBe(true)
			expect(response.status).toBe(200)
		})
	})

	describe('getVersionId', () => {
		test('get version id', async () => {
			const tempversionId = await s3.getVersionId(BUCKET_NAME, `test_folder/${testFile}`)
			versionId = tempversionId
			expect(tempversionId).toBeTruthy()
		})

		test('get version id for non-existing file', async () => {
			await expect(s3.getVersionId(BUCKET_NAME, 'non-existing-file.txt')).rejects.toThrow()
		})
	})

	describe('generatePresignedDownloadUrl', () => {
		test('generate pre-signed download URL for latest version', async () => {
			const url = await s3.generatePresignedDownloadUrl(BUCKET_NAME, `test_folder/${testFile}`, 60)
			expect(url).toContain('https://')

			const response = await fetch(url, {
				method: 'GET',
			})
			expect(response.ok).toBe(true)
			expect(response.status).toBe(200)
		})

		test('generate pre-signed download URL for specific version', async () => {
			const url = await s3.generatePresignedDownloadUrl(BUCKET_NAME, `${testFolder}/${testFile}`, 60, versionId)
			expect(url).toContain('https://')

			const response = await fetch(url, {
				method: 'GET',
			})
			expect(response.ok).toBe(true)
			expect(response.status).toBe(200)
		})
	})

	describe('deleteDocument', () => {
		test('delete a document', async () => {
			const response = await s3.deleteDocument(BUCKET_NAME, testFolder, testFile)
			expect(response).toBeTruthy()
		})
	})

	describe('deleteDocumentVersion', () => {
		test('delete a document version', async () => {
			const response = await s3.deleteDocumentVersion(BUCKET_NAME, 'test_folder', testFile, versionId)
			expect(response).toBeTruthy()
		})
	})
})

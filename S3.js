const {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
	ListObjectsV2Command,
	DeleteObjectCommand,
	HeadObjectCommand,
	DeleteObjectsCommand,
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

class HttpError extends Error {
	constructor(message, statusCode) {
		super(message)
		this.statusCode = statusCode
		this.name = this.constructor.name
	}
}

class S3 {
	/**
	 *
	 * @param {Object} config  - Configuration object for the S3 client
	 * @param {boolean|false} [dev=false] - Optional. Whether the app is running in development mode
	 */
	constructor(config, dev = false) {
		this.client = new S3Client(config)
		this.dev = dev
	}

	/**
	 * Generate a pre-signed URL for uploading a file to S3
	 *
	 * @param {string} bucket - The bucket to upload the object to
	 * @param {string} key - The key the uploaded object will have in the bucket
	 * @param {number} [expiresIn=60] - Optional. Expiration time in seconds for the link
	 * @returns {string} pre-signed URL
	 * @throws {Error} if the pre-signed URL could not be generated
	 */
	async generatePresignedUploadUrl(bucket, key, expiresIn = 60) {
		try {
			const params = {
				Bucket: bucket,
				Key: key,
			}
			const command = new PutObjectCommand(params)
			return await getSignedUrl(this.client, command, { expiresIn })
		} catch (error) {
			if (this.dev) console.error('Error generating pre-signed upload URL: ', error)
			throw new Error('Failed to generate pre-signed upload URL')
		}
	}

	/**
	 *	Generate a pre-signed URL for downloading a file from S3
	 *
	 * @param {string} bucket - The bucket to upload the object to
	 * @param {string} key - The key the uploaded object will have in the bucket
	 * @param {number} [expiresIn=60] - Optional. Expiration time in seconds for the link
	 * @param {string} versionId - Optional. Version ID of the object to download
	 * @returns {string} pre-signed URL
	 * @throws {Error} if the pre-signed URL could not be generated
	 */
	async generatePresignedDownloadUrl(bucket, key, expiresIn = 60, versionId = null) {
		try {
			const params = {
				Bucket: bucket,
				Key: key,
			}

			if (versionId) {
				params.VersionId = versionId
			}
			const command = new GetObjectCommand(params)
			return await getSignedUrl(this.client, command, { expiresIn })
		} catch (error) {
			if (this.dev) console.error('Error generating pre-signed download URL for version: ', error)
			throw new Error('Failed to generate pre-signed download URL for version')
		}
	}

	/**
	 * Get the version ID of an object in S3
	 *
	 * @param {string} bucket - The bucket to upload the object to
	 * @param {string} key - The key the uploaded object will have in the bucket
	 * @returns {string} version ID of the uploaded object
	 * @throws {Error} if the version ID could not be retrieved
	 */
	async getVersionId(bucket, key) {
		try {
			const params = {
				Bucket: bucket,
				Key: key,
			}
			const command = new HeadObjectCommand(params)
			const response = await this.client.send(command)

			return response.VersionId
		} catch (error) {
			if (this.dev) console.error('Error retrieving version ID: ', error)
			throw new Error('Failed to retrieve version ID')
		}
	}

	/**
	 * Create a folder in an S3 bucket
	 *
	 * @param {string} bucket - The name of the bucket where the folder will be created
	 * @param {string} folder - The name of the folder to create
	 * @returns {Promise<Object>} Response from the S3 client
	 * @throws {Error} if the folder could not be created
	 */
	async createFolder(bucket, folder) {
		try {
			const params = {
				Bucket: bucket,
				Key: folder + '/',
				Body: Buffer.from(''),
			}
			return this.client.send(new PutObjectCommand(params))
		} catch (error) {
			if (this.dev) console.error('Error creating folder: ', error)
			throw new Error('Failed to create folder')
		}
	}

	/**
	 * Delete a folder and all its contents in an S3 bucket
	 *
	 * @param {string} bucket - The name of the bucket containing the folder
	 * @param {string} folder - The name of the folder to delete
	 * @returns {Promise<void>} Logs success or failure message
	 * @throws {Error} if the folder or its contents could not be deleted
	 */
	async deleteFolder(bucket, folder) {
		try {
			const params = {
				Bucket: bucket, // Name of the bucket
				Prefix: folder + '/', // Prefix specifying the folder (and its contents)
			}
			const listResponse = await this.client.send(new ListObjectsV2Command(params)) // Retrieves objects in the folder
			const objectsToDelete = listResponse.Contents
			if (objectsToDelete && objectsToDelete.length > 0) {
				objectsToDelete.forEach(async (object) => {
					const deleteParams = {
						Bucket: bucket,
						Key: object.Key,
					}
					await this.client.send(new DeleteObjectCommand(deleteParams))
				})
			} else {
				if (this.dev) console.log(`${folder} Does not exist`)
				throw new HttpError('Folder does not exist', 404)
			}
		} catch (error) {
			if (this.dev) console.log('Error deleting folder: ', error)
			if (error instanceof HttpError) throw error
			throw new Error('Failed to delete folder')
		}
	}

	/**
	 * Delete a single document from a folder in an S3 bucket
	 *
	 * @param {string} bucket - The name of the bucket containing the document
	 * @param {string} folder - The name of the folder containing the document
	 * @param {string} key - The key (filename) of the document to delete
	 * @returns {Promise<Object>} Response from the S3 client
	 * @throws {Error} if the document could not be deleted
	 */
	async deleteDocument(bucket, folder, key) {
		try {
			const params = {
				Bucket: bucket, // Name of the bucket
				Key: folder + '/' + key, // Full path of the document to delete
			}
			return this.client.send(new DeleteObjectCommand(params)) // Sends the command to delete the document
		} catch (error) {
			if (this.dev) console.error('Error deleting document: ', error) // Logs error details
			throw new Error('Failed to delete document') // Throws error if document deletion fails
		}
	}

	/**
	 * Delete a specific version of a document in an S3 bucket
	 *
	 * @param {string} bucket - The name of the bucket containing the document
	 * @param {string} folder - The name of the folder containing the document
	 * @param {string} key - The key (filename) of the document to delete
	 * @param {string} versionId - The version ID of the document to delete
	 * @returns {Promise<Object>} Response from the S3 client
	 * @throws {Error} if the document version could not be deleted
	 */
	async deleteDocumentVersion(bucket, folder, key, versionId) {
		try {
			const params = {
				Bucket: bucket, // Name of the bucket
				Key: folder + '/' + key, // Full path of the document
				VersionId: versionId, // The version ID of the document to delete
			}
			return this.client.send(new DeleteObjectCommand(params)) // Sends the command to delete the specific version
		} catch (error) {
			if (this.dev) console.error('Error deleting document version: ', error) // Logs error details
			throw new Error('Failed to delete document version') // Throws error if version deletion fails
		}
	}
}

module.exports = S3

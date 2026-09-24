const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

const uploadSingle = upload.single('file');
const uploadMultiple = upload.array('files', 10);

module.exports = { upload, uploadSingle, uploadMultiple };
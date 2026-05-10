import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// export const upload = multer({
//   storage: storage,
//   limits: { fileSize: 10 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const filetypes =
//       /jpeg|jpg|png|pdf|png|mp4|avi|mov|avif|webp|doc|docx|mp3|mpeg|wav|m4a|xls|xlsx|ppt|pptx/;

//     const mimetype = filetypes.test(file.mimetype);
//     const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
//     console.log(mimetype);
//     console.log(extname);

//     if (mimetype && extname) {
//       return cb(null, true);
//     }
//     cb(new Error('This file type is not allowed!'));
//   },
// });

// ✅ Allowed MIME types
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
  'video/mp4',
  'video/x-msvideo',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

// ✅ Allowed Extensions
const allowedExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.pdf',
  '.mp4',
  '.avi',
  '.mov',
  '.mp3',
  '.wav',
  '.m4a',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
];

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },

  fileFilter: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname).toLowerCase();

      const isMimeValid = allowedMimeTypes.includes(file.mimetype);
      const isExtValid = allowedExtensions.includes(ext);

      console.log('MIME:', file.mimetype);
      console.log('EXT:', ext);

      if (isMimeValid && isExtValid) {
        return cb(null, true);
      }

      return cb(new Error('This file type is not allowed!'));
    } catch (error) {
      return cb(new Error('File validation failed!'));
    }
  },
});

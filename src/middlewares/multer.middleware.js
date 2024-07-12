import multer from 'multer';

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/temp'); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
  
    cb(null, file.fieldname + '-' + uniqueSuffix + file.originalname);
  }
});

// Multer upload middleware
const upload = multer({ storage: storage });
export {upload};

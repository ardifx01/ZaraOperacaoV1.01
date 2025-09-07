const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs').promises;
const { requireOperator } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();
const prisma = new PrismaClient();

// Configurações de upload
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Criar diretório de uploads se não existir
const ensureUploadDir = async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(path.join(UPLOAD_DIR, 'images'), { recursive: true });
    await fs.mkdir(path.join(UPLOAD_DIR, 'videos'), { recursive: true });
  }
};

// @desc    Upload de imagem para teste de qualidade
// @route   POST /api/upload/quality-test-image
// @access  Private (Operator+)
router.post('/quality-test-image', requireOperator, asyncHandler(async (req, res) => {
  await ensureUploadDir();

  if (!req.files || !req.files.image) {
    throw new AppError('Nenhuma imagem foi enviada', 400, 'NO_IMAGE_PROVIDED');
  }

  const image = req.files.image;

  // Validar tipo de arquivo
  if (!ALLOWED_IMAGE_TYPES.includes(image.mimetype)) {
    throw new AppError('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP', 400, 'INVALID_FILE_TYPE');
  }

  // Validar tamanho
  if (image.size > MAX_FILE_SIZE) {
    throw new AppError('Arquivo muito grande. Máximo 10MB', 400, 'FILE_TOO_LARGE');
  }

  // Gerar nome único
  const timestamp = Date.now();
  const extension = path.extname(image.name);
  const filename = `quality_test_${timestamp}_${req.user.id}${extension}`;
  const filepath = path.join(UPLOAD_DIR, 'images', filename);

  try {
    // Mover arquivo
    await image.mv(filepath);

    // URL pública do arquivo
    const fileUrl = `/uploads/images/${filename}`;

    // Log da ação
    await prisma.systemLog.create({
      data: {
        action: 'IMAGE_UPLOADED',
        userId: req.user.id,
        details: JSON.stringify({
          filename,
          originalName: image.name,
          size: image.size,
          mimetype: image.mimetype,
          purpose: 'quality_test'
        }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      success: true,
      message: 'Imagem enviada com sucesso',
      data: {
        filename,
        url: fileUrl,
        size: image.size,
        mimetype: image.mimetype
      }
    });
  } catch (error) {
    throw new AppError('Erro ao salvar imagem', 500, 'UPLOAD_ERROR');
  }
}));

// @desc    Upload de vídeo para teste de qualidade
// @route   POST /api/upload/quality-test-video
// @access  Private (Operator+)
router.post('/quality-test-video', requireOperator, asyncHandler(async (req, res) => {
  await ensureUploadDir();

  if (!req.files || !req.files.video) {
    throw new AppError('Nenhum vídeo foi enviado', 400, 'NO_VIDEO_PROVIDED');
  }

  const video = req.files.video;

  // Validar tipo de arquivo
  if (!ALLOWED_VIDEO_TYPES.includes(video.mimetype)) {
    throw new AppError('Tipo de arquivo não permitido. Use MP4, WebM ou QuickTime', 400, 'INVALID_FILE_TYPE');
  }

  // Validar tamanho (vídeos podem ser maiores)
  const maxVideoSize = 50 * 1024 * 1024; // 50MB para vídeos
  if (video.size > maxVideoSize) {
    throw new AppError('Arquivo muito grande. Máximo 50MB para vídeos', 400, 'FILE_TOO_LARGE');
  }

  // Gerar nome único
  const timestamp = Date.now();
  const extension = path.extname(video.name);
  const filename = `quality_test_${timestamp}_${req.user.id}${extension}`;
  const filepath = path.join(UPLOAD_DIR, 'videos', filename);

  try {
    // Mover arquivo
    await video.mv(filepath);

    // URL pública do arquivo
    const fileUrl = `/uploads/videos/${filename}`;

    // Log da ação
    await prisma.systemLog.create({
      data: {
        action: 'VIDEO_UPLOADED',
        userId: req.user.id,
        details: JSON.stringify({
          filename,
          originalName: video.name,
          size: video.size,
          mimetype: video.mimetype,
          purpose: 'quality_test'
        }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      success: true,
      message: 'Vídeo enviado com sucesso',
      data: {
        filename,
        url: fileUrl,
        size: video.size,
        mimetype: video.mimetype
      }
    });
  } catch (error) {
    throw new AppError('Erro ao salvar vídeo', 500, 'UPLOAD_ERROR');
  }
}));

// @desc    Upload múltiplo de imagens
// @route   POST /api/upload/quality-test-images
// @access  Private (Operator+)
router.post('/quality-test-images', requireOperator, asyncHandler(async (req, res) => {
  await ensureUploadDir();

  if (!req.files || !req.files.images) {
    throw new AppError('Nenhuma imagem foi enviada', 400, 'NO_IMAGES_PROVIDED');
  }

  let images = req.files.images;
  
  // Se for apenas uma imagem, transformar em array
  if (!Array.isArray(images)) {
    images = [images];
  }

  // Validar número máximo de imagens
  if (images.length > 10) {
    throw new AppError('Máximo 10 imagens por upload', 400, 'TOO_MANY_FILES');
  }

  const uploadedFiles = [];
  const errors = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];

    try {
      // Validar tipo de arquivo
      if (!ALLOWED_IMAGE_TYPES.includes(image.mimetype)) {
        errors.push(`${image.name}: Tipo de arquivo não permitido`);
        continue;
      }

      // Validar tamanho
      if (image.size > MAX_FILE_SIZE) {
        errors.push(`${image.name}: Arquivo muito grande (máximo 10MB)`);
        continue;
      }

      // Gerar nome único
      const timestamp = Date.now();
      const extension = path.extname(image.name);
      const filename = `quality_test_${timestamp}_${i}_${req.user.id}${extension}`;
      const filepath = path.join(UPLOAD_DIR, 'images', filename);

      // Mover arquivo
      await image.mv(filepath);

      // URL pública do arquivo
      const fileUrl = `/uploads/images/${filename}`;

      uploadedFiles.push({
        filename,
        url: fileUrl,
        originalName: image.name,
        size: image.size,
        mimetype: image.mimetype
      });

    } catch (error) {
      errors.push(`${image.name}: Erro ao processar arquivo`);
    }
  }

  // Log da ação
  if (uploadedFiles.length > 0) {
    await prisma.systemLog.create({
      data: {
        action: 'MULTIPLE_IMAGES_UPLOADED',
        userId: req.user.id,
        details: JSON.stringify({
          uploadedCount: uploadedFiles.length,
          errorCount: errors.length,
          files: uploadedFiles.map(f => ({ filename: f.filename, size: f.size })),
          purpose: 'quality_test'
        }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
  }

  res.json({
    success: uploadedFiles.length > 0,
    message: `${uploadedFiles.length} imagens enviadas com sucesso`,
    data: {
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    }
  });
}));

// @desc    Deletar arquivo
// @route   DELETE /api/upload/:filename
// @access  Private (Operator+)
router.delete('/:filename', [
  param('filename').notEmpty().withMessage('Nome do arquivo é obrigatório')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { filename } = req.params;

  // Validar nome do arquivo (segurança)
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new AppError('Nome de arquivo inválido', 400, 'INVALID_FILENAME');
  }

  // Tentar encontrar o arquivo em ambos os diretórios
  const imagePath = path.join(UPLOAD_DIR, 'images', filename);
  const videoPath = path.join(UPLOAD_DIR, 'videos', filename);

  let filePath = null;
  let fileType = null;

  try {
    await fs.access(imagePath);
    filePath = imagePath;
    fileType = 'image';
  } catch {
    try {
      await fs.access(videoPath);
      filePath = videoPath;
      fileType = 'video';
    } catch {
      throw new AppError('Arquivo não encontrado', 404, 'FILE_NOT_FOUND');
    }
  }

  try {
    // Deletar arquivo
    await fs.unlink(filePath);

    // Log da ação
    await prisma.systemLog.create({
      data: {
        action: 'FILE_DELETED',
        userId: req.user.id,
        details: JSON.stringify({
          filename,
          fileType,
          path: filePath
        }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      success: true,
      message: 'Arquivo deletado com sucesso'
    });
  } catch (error) {
    throw new AppError('Erro ao deletar arquivo', 500, 'DELETE_ERROR');
  }
}));

// @desc    Listar arquivos do usuário
// @route   GET /api/upload/my-files
// @access  Private (Operator+)
router.get('/my-files', requireOperator, asyncHandler(async (req, res) => {
  // Buscar logs de upload do usuário
  const uploadLogs = await prisma.systemLog.findMany({
    where: {
      userId: req.user.id,
      action: {
        in: ['IMAGE_UPLOADED', 'VIDEO_UPLOADED', 'MULTIPLE_IMAGES_UPLOADED']
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50 // Últimos 50 uploads
  });

  const files = [];

  for (const log of uploadLogs) {
    if (log.action === 'MULTIPLE_IMAGES_UPLOADED') {
      // Para uploads múltiplos, adicionar cada arquivo
      if (log.details.files) {
        for (const file of log.details.files) {
          const filePath = path.join(UPLOAD_DIR, 'images', file.filename);
          try {
            await fs.access(filePath);
            files.push({
              filename: file.filename,
              url: `/uploads/images/${file.filename}`,
              size: file.size,
              type: 'image',
              uploadedAt: log.createdAt,
              exists: true
            });
          } catch {
            files.push({
              filename: file.filename,
              url: `/uploads/images/${file.filename}`,
              size: file.size,
              type: 'image',
              uploadedAt: log.createdAt,
              exists: false
            });
          }
        }
      }
    } else {
      // Para uploads únicos
      const filename = log.details.filename;
      const isVideo = log.action === 'VIDEO_UPLOADED';
      const directory = isVideo ? 'videos' : 'images';
      const filePath = path.join(UPLOAD_DIR, directory, filename);
      
      try {
        await fs.access(filePath);
        files.push({
          filename,
          url: `/uploads/${directory}/${filename}`,
          size: log.details.size,
          type: isVideo ? 'video' : 'image',
          mimetype: log.details.mimetype,
          originalName: log.details.originalName,
          uploadedAt: log.createdAt,
          exists: true
        });
      } catch {
        files.push({
          filename,
          url: `/uploads/${directory}/${filename}`,
          size: log.details.size,
          type: isVideo ? 'video' : 'image',
          mimetype: log.details.mimetype,
          originalName: log.details.originalName,
          uploadedAt: log.createdAt,
          exists: false
        });
      }
    }
  }

  res.json({
    success: true,
    data: files
  });
}));

// @desc    Obter informações de um arquivo
// @route   GET /api/upload/info/:filename
// @access  Private (Operator+)
router.get('/info/:filename', [
  param('filename').notEmpty().withMessage('Nome do arquivo é obrigatório')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { filename } = req.params;

  // Validar nome do arquivo
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new AppError('Nome de arquivo inválido', 400, 'INVALID_FILENAME');
  }

  // Tentar encontrar o arquivo
  const imagePath = path.join(UPLOAD_DIR, 'images', filename);
  const videoPath = path.join(UPLOAD_DIR, 'videos', filename);

  let filePath = null;
  let fileType = null;
  let fileStats = null;

  try {
    await fs.access(imagePath);
    filePath = imagePath;
    fileType = 'image';
    fileStats = await fs.stat(imagePath);
  } catch {
    try {
      await fs.access(videoPath);
      filePath = videoPath;
      fileType = 'video';
      fileStats = await fs.stat(videoPath);
    } catch {
      throw new AppError('Arquivo não encontrado', 404, 'FILE_NOT_FOUND');
    }
  }

  // Buscar log de upload
  const uploadLog = await prisma.systemLog.findFirst({
    where: {
      action: {
        in: ['IMAGE_UPLOADED', 'VIDEO_UPLOADED']
      },
      'details.filename': filename
    },
    orderBy: { createdAt: 'desc' }
  });

  const fileInfo = {
    filename,
    url: `/uploads/${fileType}s/${filename}`,
    type: fileType,
    size: fileStats.size,
    createdAt: fileStats.birthtime,
    modifiedAt: fileStats.mtime,
    exists: true
  };

  if (uploadLog) {
    fileInfo.originalName = uploadLog.details.originalName;
    fileInfo.mimetype = uploadLog.details.mimetype;
    fileInfo.uploadedBy = uploadLog.userId;
    fileInfo.uploadedAt = uploadLog.createdAt;
  }

  res.json({
    success: true,
    data: fileInfo
  });
}));

// @desc    Upload de imagens para troca de teflon
// @route   POST /api/upload/teflon-images
// @access  Private (Operator+)
router.post('/teflon-images', requireOperator, asyncHandler(async (req, res) => {
  await ensureUploadDir();

  if (!req.files || !req.files.images) {
    throw new AppError('Nenhuma imagem foi enviada', 400, 'NO_IMAGES_PROVIDED');
  }

  const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
  const uploadedFiles = [];

  for (const image of images) {
    // Validar tipo de arquivo
    if (!ALLOWED_IMAGE_TYPES.includes(image.mimetype)) {
      throw new AppError(
        `Tipo de arquivo não permitido: ${image.mimetype}. Tipos permitidos: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        400,
        'INVALID_FILE_TYPE'
      );
    }

    // Validar tamanho do arquivo
    if (image.size > MAX_FILE_SIZE) {
      throw new AppError(
        `Arquivo muito grande: ${(image.size / 1024 / 1024).toFixed(2)}MB. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(image.name);
    const filename = `teflon_${timestamp}_${randomString}${extension}`;
    const filepath = path.join(UPLOAD_DIR, 'images', filename);

    // Mover arquivo para o diretório de uploads
    await image.mv(filepath);

    // Log da ação
    await prisma.systemLog.create({
      data: {
        userId: req.user.id,
        action: 'TEFLON_IMAGE_UPLOADED',
        details: JSON.stringify({
          filename,
          originalName: image.name,
          mimetype: image.mimetype,
          size: image.size
        })
      }
    });

    uploadedFiles.push({
      filename,
      originalName: image.name,
      url: `/uploads/images/${filename}`,
      size: image.size
    });
  }

  res.json({
    success: true,
    message: `${uploadedFiles.length} imagem(ns) enviada(s) com sucesso`,
    data: uploadedFiles
  });
}));

// @desc    Upload de avatar do usuário
// @route   POST /api/upload/avatar
// @access  Private
router.post('/avatar', asyncHandler(async (req, res) => {
  await ensureUploadDir();

  if (!req.files || !req.files.avatar) {
    throw new AppError('Nenhuma imagem foi enviada', 400, 'NO_IMAGE_PROVIDED');
  }

  const avatar = req.files.avatar;

  // Validar tipo de arquivo
  if (!ALLOWED_IMAGE_TYPES.includes(avatar.mimetype)) {
    throw new AppError('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP', 400, 'INVALID_FILE_TYPE');
  }

  // Validar tamanho (limite menor para avatares)
  const maxAvatarSize = 2 * 1024 * 1024; // 2MB para avatares
  if (avatar.size > maxAvatarSize) {
    throw new AppError('Arquivo muito grande. Máximo 2MB para avatares', 400, 'FILE_TOO_LARGE');
  }

  // Gerar nome único
  const timestamp = Date.now();
  const extension = path.extname(avatar.name);
  const filename = `avatar_${req.user.id}_${timestamp}${extension}`;
  const filepath = path.join(UPLOAD_DIR, 'avatars', filename);

  try {
    // Criar diretório de avatares se não existir
    await fs.mkdir(path.join(UPLOAD_DIR, 'avatars'), { recursive: true });

    // Remover avatar anterior se existir
    if (req.user.avatar) {
      const oldAvatarPath = path.join(UPLOAD_DIR, 'avatars', path.basename(req.user.avatar));
      try {
        await fs.unlink(oldAvatarPath);
      } catch (error) {
        // Ignorar erro se arquivo não existir
      }
    }

    // Mover novo arquivo
    await avatar.mv(filepath);

    // URL pública do arquivo
    const avatarUrl = `/uploads/avatars/${filename}`;

    // Atualizar avatar do usuário no banco
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: avatarUrl }
    });

    // Log da ação
    await prisma.systemLog.create({
      data: {
        action: 'AVATAR_UPLOADED',
        userId: req.user.id,
        details: JSON.stringify({
          filename,
          originalName: avatar.name,
          size: avatar.size,
          mimetype: avatar.mimetype,
          oldAvatar: req.user.avatar
        }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      success: true,
      message: 'Avatar atualizado com sucesso',
      data: {
        avatarUrl,
        filename,
        size: avatar.size
      }
    });
  } catch (error) {
    throw new AppError('Erro ao salvar avatar', 500, 'UPLOAD_ERROR');
  }
}));

module.exports = router;
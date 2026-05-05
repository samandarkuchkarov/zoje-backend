import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { config } from './config.js';
import {
  createProduct,
  getCategories,
  getProductBySlug,
  getRelatedProducts,
  listProducts,
  reorderProducts,
  updateProduct,
} from './productsRepository.js';
import { authenticateAdmin, requireAdmin } from './auth.js';

const app = express();
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        callback(null, uploadDir);
      } catch (error) {
        callback(error as Error, uploadDir);
      }
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const baseName =
        safeFilePart(path.basename(file.originalname, extension)) || 'image';
      callback(null, `${Date.now()}-${baseName}${extension}`);
    },
  }),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 20,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image uploads are allowed'));
      return;
    }
    callback(null, true);
  },
});

const LocalizedTextSchema = z.object({
  uz: z.string().min(1),
  ru: z.string().min(1),
});

const ProductSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: LocalizedTextSchema,
  category: z.enum([
    'industrial',
    'overlock',
    'buttonhole',
    'bartack',
    'pattern',
    'embroidery',
    'heavy-duty',
    'domestic',
    'specialty',
  ]),
  model: z.string().min(1),
  images: z.array(z.string()).default([]),
  price: z.number().int().nonnegative(),
  oldPrice: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int().optional(),
  inStock: z.boolean(),
  featured: z.boolean().optional(),
  hidden: z.boolean().optional(),
  placeholder: z.boolean().optional(),
  officialUrl: z.string().optional(),
  videoUrls: z.array(z.string()).optional(),
  manuals: z
    .array(z.object({ label: z.string(), url: z.string() }))
    .optional(),
  supportMaterialUrl: z.string().optional(),
  officialDescriptionRu: z.string().optional(),
  officialParameters: z
    .array(
      z.object({
        className: z.string(),
        rows: z.array(
          z.array(
            z.object({
              text: z.string(),
              images: z.array(z.string()),
            })
          )
        ),
      })
    )
    .optional(),
  shortDescription: LocalizedTextSchema,
  description: LocalizedTextSchema,
  specs: z.record(z.string().optional()).default({}),
});

function sendJson(res: express.Response, body: unknown, status = 200) {
  if (process.env.NODE_ENV !== 'production') {
    if (Array.isArray(body)) {
      console.log('[zoje backend] result', {
        type: 'array',
        count: body.length,
        first: body[0]?.slug ?? body[0]?.id ?? null,
      });
    } else if (
      body &&
      typeof body === 'object' &&
      'token' in body
    ) {
      console.log('[zoje backend] result', { ...body, token: '[redacted]' });
    } else {
      console.log('[zoje backend] result', body);
    }
  }

  res.status(status).json(body);
}


app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: config.corsOrigin.split(',').map((origin) => origin.trim()),
  })
);
app.use(express.json());

app.use((req, res, next) => {
  const startedAt = Date.now();
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  res.on('finish', () => {
    console.log(
      `[zoje backend] ${req.method} ${url} -> ${res.statusCode} ${Date.now() - startedAt}ms`
    );
  });

  next();
});

app.use('/assets', express.static(path.join(process.cwd(), 'public'), {
  immutable: true,
  maxAge: '30d',
}));

app.get('/health', (_req, res) => {
  sendJson(res, { ok: true });
});

app.get('/api/categories', async (_req, res, next) => {
  try {
    sendJson(res, await getCategories());
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (req, res, next) => {
  try {
    const query = z
      .object({
        category: z.string().optional(),
        featured: z.enum(['true', 'false']).optional(),
        inStock: z.enum(['true', 'false']).optional(),
        q: z.string().trim().min(1).optional(),
        sort: z.enum(['newest', 'priceAsc', 'priceDesc']).optional(),
      })
      .parse(req.query);

    const products = await listProducts({
      category: query.category as never,
      featured:
        query.featured === undefined ? undefined : query.featured === 'true',
      inStock:
        query.inStock === undefined ? undefined : query.inStock === 'true',
      q: query.q,
      sort: query.sort,
    });

    sendJson(res, products);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:slug', async (req, res, next) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    if (!product) {
      sendJson(res, { error: 'Product not found' }, 404);
      return;
    }
    sendJson(res, product);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:slug/related', async (req, res, next) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    if (!product) {
      sendJson(res, { error: 'Product not found' }, 404);
      return;
    }
    sendJson(res, await getRelatedProducts(product));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/login', async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const admin = await authenticateAdmin(body.email, body.password);
    if (!admin) {
      sendJson(res, { error: 'Invalid email or password' }, 401);
      return;
    }

    sendJson(res, admin);
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/products', requireAdmin, async (_req, res, next) => {
  try {
    sendJson(res, await listProducts({ includeHidden: true }));
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/admin/uploads/images',
  requireAdmin,
  imageUpload.array('images', 20),
  (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];
    const images = files.map((file) => {
      const assetPath = path
        .relative(path.join(process.cwd(), 'public'), file.path)
        .split(path.sep)
        .join('/');
      return `${config.publicBaseUrl}/assets/${assetPath}`;
    });

    sendJson(res, { images }, 201);
  }
);

app.post('/api/admin/products', requireAdmin, async (req, res, next) => {
  try {
    const product = ProductSchema.parse(req.body);
    sendJson(res, await createProduct(product), 201);
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/products/:slug', requireAdmin, async (req, res, next) => {
  try {
    const product = ProductSchema.parse(req.body);
    const updated = await updateProduct(String(req.params.slug), product);
    if (!updated) {
      sendJson(res, { error: 'Product not found' }, 404);
      return;
    }
    sendJson(res, updated);
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/product-order', requireAdmin, async (req, res, next) => {
  try {
    const body = z
      .object({
        items: z.array(
          z.object({
            slug: z.string().min(1),
            sortOrder: z.number().int(),
          })
        ),
      })
      .parse(req.body);

    sendJson(res, await reorderProducts(body.items));
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof z.ZodError) {
      sendJson(
        res,
        { error: 'Invalid request', details: error.issues },
        400
      );
      return;
    }

    console.error(error);
    sendJson(res, { error: 'Internal server error' }, 500);
  }
);

app.listen(config.port, () => {
  console.log(`Zoje backend listening on http://localhost:${config.port}`);
});

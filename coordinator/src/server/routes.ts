import { Router, Request, Response } from 'express';
import { OrderService } from '../services/OrderService';
import { QuoteService } from '../services/QuoteService';
import { SecretService } from '../services/SecretService';
import { ChainSchema } from '@astro-bridge/sdk';
import { z } from 'zod';

export function createRouter(
  orderService: OrderService,
  quoteService: QuoteService,
  secretService: SecretService
): Router {
  const router = Router();

  // Create Order
  router.post('/orders', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        sender: z.string(),
        recipient: z.string(),
        sourceChain: ChainSchema,
        destChain: ChainSchema,
        sourceAsset: z.string(),
        destAsset: z.string(),
        amount: z.string(),
        hashlock: z.string(),
      });

      const body = schema.parse(req.body);
      const order = await orderService.createOrder(body);
      res.status(201).json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Get Order details
  router.get('/orders/:id', async (req: Request, res: Response) => {
    try {
      const order = await orderService.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all orders
  router.get('/orders', async (req: Request, res: Response) => {
    try {
      const orders = await orderService.getOrders();
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get quote
  router.get('/quotes', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        sourceChain: ChainSchema,
        destChain: ChainSchema,
        sourceAsset: z.string(),
        destAsset: z.string(),
        amount: z.string(),
      });

      const query = schema.parse(req.query);
      const quote = await quoteService.getQuote(
        query.sourceChain,
        query.destChain,
        query.sourceAsset,
        query.destAsset,
        query.amount
      );
      res.json(quote);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Store secret preimage
  router.post('/secrets', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        hashlock: z.string(),
        secret: z.string(),
      });

      const { hashlock, secret } = schema.parse(req.body);
      await secretService.registerSecret(hashlock, secret);
      res.status(201).json({ status: 'success' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Get secret preimage
  router.get('/secrets/:hashlock', async (req: Request, res: Response) => {
    try {
      const secret = await secretService.getSecret(req.params.hashlock);
      if (!secret) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      res.json({ hashlock: req.params.hashlock, secret });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Metrics endpoint
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const orders = await orderService.getOrders();
      const metrics = {
        totalOrdersCount: orders.length,
        pendingOrdersCount: orders.filter((o) => o.status === 'PENDING').length,
        lockedOrdersCount: orders.filter((o) => o.status === 'LOCKED').length,
        resolverLockedOrdersCount: orders.filter((o) => o.status === 'RESOLVER_LOCKED').length,
        claimedOrdersCount: orders.filter((o) => o.status === 'CLAIMED').length,
        settledOrdersCount: orders.filter((o) => o.status === 'SETTLED').length,
        refundedOrdersCount: orders.filter((o) => o.status === 'REFUNDED').length,
        failedOrdersCount: orders.filter((o) => o.status === 'FAILED').length,
        uptimeSeconds: Math.floor(process.uptime()),
      };
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

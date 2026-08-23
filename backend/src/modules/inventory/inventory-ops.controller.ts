import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  RequireAnyPermission,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { InventoryOpsService } from './inventory-ops.service';

@Controller('companies/:companyId/inventory')
export class InventoryOpsController {
  constructor(private readonly ops: InventoryOpsService) {}

  @Patch('categories/:categoryId/inheritance')
  @RequirePermissions('inventory.write')
  updateInheritance(
    @Param('companyId') companyId: string,
    @Param('categoryId') categoryId: string,
    @Body()
    body: {
      inheritedTaxRate?: number | null;
      inheritedAttributes?: Record<string, unknown>;
      abcClass?: string | null;
      shelfLifeDaysAlert?: number | null;
    },
  ) {
    return this.ops.updateCategoryInheritance(companyId, categoryId, body);
  }

  @Get('items/:itemId/effective-tax')
  @RequirePermissions('inventory.read')
  effectiveTax(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ops.resolveEffectiveTaxRate(companyId, itemId);
  }

  @Post('items/:itemId/categories')
  @RequirePermissions('inventory.write')
  linkCategories(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Body() body: { categoryIds: string[]; primaryCategoryId?: string },
  ) {
    return this.ops.linkItemCategories(
      companyId,
      itemId,
      body.categoryIds ?? [],
      body.primaryCategoryId,
    );
  }

  @Get('items/:itemId/relations')
  @RequirePermissions('inventory.read')
  listRelations(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ops.listItemRelations(companyId, itemId);
  }

  @Post('items/:itemId/relations')
  @RequirePermissions('inventory.write')
  addRelation(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      toItemId: string;
      relationType: 'SUBSTITUTE' | 'CROSS_SELL' | 'COMPLEMENT';
      priority?: number;
    },
  ) {
    return this.ops.addItemRelation({
      companyId,
      fromItemId: itemId,
      ...body,
    });
  }

  @Get('attribute-defs')
  @RequirePermissions('inventory.read')
  listAttrDefs(
    @Param('companyId') companyId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.ops.listAttributeDefs(companyId, categoryId);
  }

  @Post('attribute-defs')
  @RequirePermissions('inventory.write')
  createAttrDef(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      code: string;
      name: string;
      dataType?: string;
      categoryId?: string;
      isRequired?: boolean;
      options?: unknown;
    },
  ) {
    return this.ops.createAttributeDef({ companyId, ...body });
  }

  @Post('items/:itemId/attributes')
  @RequirePermissions('inventory.write')
  setAttr(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Body() body: { attributeDefId: string; valueText: string },
  ) {
    return this.ops.setItemAttribute(
      companyId,
      itemId,
      body.attributeDefId,
      body.valueText,
    );
  }

  @Get('items/:itemId/units')
  @RequirePermissions('inventory.read')
  listUnits(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ops.listUnitConversions(companyId, itemId);
  }

  @Post('items/:itemId/units')
  @RequirePermissions('inventory.write')
  addUnit(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      unitId: string;
      factorToBase: number;
      barcode?: string;
      isSellUnit?: boolean;
      isPurchaseUnit?: boolean;
    },
  ) {
    return this.ops.addUnitConversion({ companyId, itemId, ...body });
  }

  @Post('items/:itemId/matrix')
  @RequirePermissions('inventory.write')
  matrix(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Body() body: { axes: Record<string, string[]> },
  ) {
    return this.ops.generateMatrixVariants({
      companyId,
      parentItemId: itemId,
      axes: body.axes,
    });
  }

  @Post('items/:itemId/barcodes')
  @RequirePermissions('inventory.write')
  genBarcode(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      barcodeType?: string;
      unitId?: string;
      serialBased?: boolean;
      quantity?: number;
      payload?: Record<string, unknown>;
    },
  ) {
    return this.ops.generateBarcode({ companyId, itemId, ...body });
  }

  @Get('barcodes')
  @RequirePermissions('inventory.read')
  listBarcodes(@Param('companyId') companyId: string) {
    return this.ops.listBarcodes(companyId);
  }

  @Get('barcodes/lookup')
  @RequirePermissions('inventory.read')
  lookup(
    @Param('companyId') companyId: string,
    @Query('code') code: string,
  ) {
    return this.ops.lookupBarcode(companyId, code);
  }

  @Get('transfers')
  @RequirePermissions('inventory.read')
  listTransfers(@Param('companyId') companyId: string) {
    return this.ops.listTransfers(companyId);
  }

  @Post('transfers')
  @RequirePermissions('inventory.write')
  createTransfer(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      fromWarehouseId: string;
      toWarehouseId: string;
      notes?: string;
      items: Array<{ itemId: string; quantity: number }>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.ops.createTransfer({
      companyId,
      requestedById: user.userId,
      ...body,
    });
  }

  @Post('transfers/:id/ship')
  @RequirePermissions('inventory.write')
  ship(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ops.shipTransfer(companyId, id, user.userId);
  }

  @Post('transfers/:id/receive')
  @RequirePermissions('inventory.write')
  receive(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ops.receiveTransfer(companyId, id, user.userId);
  }

  @Post('reservations')
  @RequirePermissions('inventory.write')
  reserve(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      warehouseId: string;
      itemId: string;
      quantity: number;
      sourceType: string;
      sourceId: string;
      expiresInMinutes?: number;
    },
  ) {
    return this.ops.reserveStock({ companyId, ...body });
  }

  @Post('reservations/:id/release')
  @RequirePermissions('inventory.write')
  release(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.ops.releaseReservation(companyId, id);
  }

  @Get('adjustments')
  @RequireAnyPermission('inventory.read', 'finance.read')
  listAdj(@Param('companyId') companyId: string) {
    return this.ops.listAdjustments(companyId);
  }

  @Post('adjustments')
  @RequirePermissions('inventory.write')
  createAdj(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      warehouseId: string;
      reasonCode: string;
      notes?: string;
      items: Array<{ itemId: string; quantityDelta: number; unitCost?: number }>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.ops.createAdjustment({
      companyId,
      requestedById: user.userId,
      ...body,
    });
  }

  @Post('adjustments/:id/approve')
  @RequireAnyPermission('finance.approve', 'finance.write')
  approveAdj(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ops.approveAdjustment(companyId, id, user.userId);
  }

  @Post('landed-cost')
  @RequireAnyPermission('inventory.write', 'purchasing.write', 'finance.write')
  landed(
    @Param('companyId') companyId: string,
    @Body() body: { purchaseOrderId: string; goodsReceiptId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.ops.allocateLandedCost({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Post('cost-simulate')
  @RequirePermissions('inventory.read')
  simulate(
    @Body()
    body: {
      currentCost: number;
      salePrice: number;
      purchaseChangePct: number;
    },
  ) {
    return this.ops.simulateCostImpact(
      body.currentCost,
      body.salePrice,
      body.purchaseChangePct,
    );
  }

  @Post('items/bulk-import')
  @RequirePermissions('inventory.write')
  bulk(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      rows: Array<{
        name: string;
        unitCode: string;
        sku?: string;
        barcode?: string;
        categoryCode?: string;
        cost?: number;
        salePrice?: number;
        taxRate?: number;
        minStock?: number;
      }>;
    },
  ) {
    return this.ops.bulkImportItems(companyId, body.rows ?? []);
  }

  @Get('alerts')
  @RequirePermissions('inventory.read')
  alerts(@Param('companyId') companyId: string) {
    return this.ops.intelligenceAlerts(companyId);
  }

  @Post('templates/ensure')
  @RequirePermissions('inventory.write')
  ensureTemplates(@Param('companyId') companyId: string) {
    return this.ops.ensureDefaultTemplates(companyId);
  }

  @Get('label-templates')
  @RequirePermissions('inventory.read')
  labels(@Param('companyId') companyId: string) {
    return this.ops.listLabelTemplates(companyId);
  }

  @Get('invoice-templates')
  @RequirePermissions('inventory.read')
  invoiceTemplates(@Param('companyId') companyId: string) {
    return this.ops.listInvoiceTemplates(companyId);
  }

  @Get('items/:itemId/label')
  @RequirePermissions('inventory.read')
  label(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Query('template') template?: string,
  ) {
    return this.ops.renderLabel(companyId, itemId, template);
  }
}

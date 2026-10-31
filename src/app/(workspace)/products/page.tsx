"use client";

import {
  FormField,
  ModalDialog,
  MoneyDisplay,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { formatINR } from "@/lib/money";
import { Boxes, Layers, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";

interface VariantItem {
  id: string;
  name: string;
  sku: string;
  additionalPrice: number;
  finalUnitPrice: number;
  status: string;
}

interface ProductItem {
  id: string;
  productCode: string;
  name: string;
  productType: string;
  salesPrice: number;
  costPrice: number;
  description: string | null;
  status: string;
  variants: VariantItem[];
}

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [productType, setProductType] = useState("SAAS");
  const [salesPrice, setSalesPrice] = useState("1000");
  const [costPrice, setCostPrice] = useState("300");
  const [description, setDescription] = useState("");

  const [variantModalProduct, setVariantModalProduct] = useState<ProductItem | null>(null);
  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [additionalPrice, setAdditionalPrice] = useState("560");

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const json = await res.json();
      if (json.success) {
        setProducts(json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        productType,
        salesPrice: Number(salesPrice),
        costPrice: Number(costPrice),
        description,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Failed to create product",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Product Created",
      description: `${json.data.productCode} (${json.data.name}) added to catalog.`,
      variant: "success",
    });
    setProductModalOpen(false);
    setName("");
    setDescription("");
    loadProducts();
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantModalProduct) return;

    const res = await fetch(`/api/products/${variantModalProduct.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: variantName,
        sku: variantSku,
        additionalPrice: Number(additionalPrice),
      }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Variant Creation Failed",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Variant Added",
      description: `${variantName}: Final Unit Price = ${formatINR(json.data.finalUnitPrice)}`,
      variant: "success",
    });
    setVariantModalProduct(null);
    setVariantName("");
    setVariantSku("");
    loadProducts();
  };

  const toggleVariantStatus = async (variant: VariantItem) => {
    const nextStatus = variant.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/products/any/variants`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: variant.id, status: nextStatus }),
    });
    const json = await res.json();
    if (json.success) {
      toast({
        title: `Variant ${nextStatus}`,
        description: `${variant.name} status updated.`,
        variant: "info",
      });
      loadProducts();
    }
  };

  return (
    <div>
      <PageHeader
        category="CATALOG & PRICING ENGINE"
        title="Products & Product Variants"
        description="Final Unit Price = Base Sales Price + Variant Additional Price. Historical prices are snapshotted onto subscription and invoice line items."
        actions={
          <button
            type="button"
            onClick={() => setProductModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            New Product
          </button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border bg-bg-subtle/40 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold text-brand">
                      {prod.productCode}
                    </span>
                    <h2 className="text-base font-semibold text-text-primary">{prod.name}</h2>
                    <StatusBadge status={prod.productType} />
                    <StatusBadge status={prod.status} />
                  </div>
                  {prod.description && (
                    <p className="mt-1 text-xs text-text-muted">{prod.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-[10px] font-mono uppercase text-text-muted">
                      Base Sales Price
                    </div>
                    <MoneyDisplay amount={prod.salesPrice} size="lg" />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono uppercase text-text-muted">
                      Cost Price
                    </div>
                    <MoneyDisplay
                      amount={prod.costPrice}
                      size="md"
                      className="text-text-secondary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVariantModalProduct(prod);
                      setVariantSku(`${prod.productCode}-VAR-${prod.variants.length + 1}`);
                    }}
                    className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-3 text-xs font-medium text-text-primary hover:border-brand"
                  >
                    <Layers className="h-3.5 w-3.5 text-brand" />
                    Add Variant
                  </button>
                </div>
              </div>

              {/* Variants Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-bg-subtle/20 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      <th className="px-5 py-2.5">Variant Name</th>
                      <th className="px-5 py-2.5">SKU</th>
                      <th className="px-5 py-2.5 text-right">Base Price</th>
                      <th className="px-5 py-2.5 text-right">+ Variant Additional Price</th>
                      <th className="px-5 py-2.5 text-right">= Final Unit Price</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {prod.variants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-4 text-text-muted">
                          No variants configured — uses Base Sales Price ({formatINR(prod.salesPrice)}).
                        </td>
                      </tr>
                    ) : (
                      prod.variants.map((v) => (
                        <tr key={v.id} className="hover:bg-bg-subtle/40">
                          <td className="px-5 py-3 font-semibold text-text-primary">{v.name}</td>
                          <td className="px-5 py-3 font-mono text-text-secondary">{v.sku}</td>
                          <td className="px-5 py-3 text-right font-mono text-text-secondary">
                            {formatINR(prod.salesPrice)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-brand font-medium">
                            + {formatINR(v.additionalPrice)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-bold text-text-primary">
                            {formatINR(v.finalUnitPrice)}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={v.status} />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleVariantStatus(v)}
                              className="rounded border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                            >
                              {v.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Product Modal */}
      <ModalDialog
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title="Create New Product"
        description="Configure base sales price, cost price, and product classification."
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <FormField label="Product Name" required>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cloud ERP Enterprise"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
            />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Product Type" required>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 text-xs"
              >
                <option value="SAAS">SAAS</option>
                <option value="SERVICE">SERVICE</option>
                <option value="LICENSE">LICENSE</option>
                <option value="ADDON">ADDON</option>
                <option value="HARDWARE">HARDWARE</option>
              </select>
            </FormField>
            <FormField label="Base Sales Price (INR)" required>
              <input
                type="number"
                step="0.01"
                required
                value={salesPrice}
                onChange={(e) => setSalesPrice(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
            <FormField label="Cost Price (INR)" required>
              <input
                type="number"
                step="0.01"
                required
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-base p-2.5 text-xs"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setProductModalOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover"
            >
              Create Product
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Create Variant Modal */}
      <ModalDialog
        open={Boolean(variantModalProduct)}
        onClose={() => setVariantModalProduct(null)}
        title={`Add Variant to ${variantModalProduct?.name || ""}`}
        description="Final Unit Price = Base Sales Price + Variant Additional Price"
      >
        {variantModalProduct && (
          <form onSubmit={handleCreateVariant} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Variant Name" required>
                <input
                  type="text"
                  required
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="e.g., Odoo / Premium"
                  className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
                />
              </FormField>
              <FormField label="Variant SKU" required>
                <input
                  type="text"
                  required
                  value={variantSku}
                  onChange={(e) => setVariantSku(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
                />
              </FormField>
            </div>

            <FormField label="Variant Additional Price (INR)" required>
              <input
                type="number"
                step="0.01"
                required
                value={additionalPrice}
                onChange={(e) => setAdditionalPrice(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>

            <div className="rounded-md border border-border bg-bg-subtle p-3.5 flex items-center justify-between text-xs font-mono">
              <span>
                Base ({formatINR(variantModalProduct.salesPrice)}) + Additional (
                {formatINR(Number(additionalPrice || 0))})
              </span>
              <span className="font-bold text-brand text-sm">
                = {formatINR(variantModalProduct.salesPrice + Number(additionalPrice || 0))}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setVariantModalProduct(null)}
                className="h-8 rounded-md border border-border px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover"
              >
                Save Variant
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
}

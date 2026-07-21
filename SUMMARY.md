# Order Status Tracker — Concept Summary

## What it is

A shared, internal web app for tracking web/sales orders from placement through to
delivery (or cancellation). Built to sit alongside ABM (your SQL-based accounting
system) rather than replace it — ABM stays the source of truth for orders; this app
adds the day-to-day tracking and visibility ABM doesn't give you.

No login required — it's meant for a small internal team (2+ staff) on the local
network, all looking at the same shared order list at once.

## How orders get in

Right now: **export from ABM → upload to the tracker.**

- Someone exports the Sales Order list from ABM to Excel.
- They click "Import orders from Excel" in the tracker and upload it.
- The tracker reads `Reference` (ABM's order number), `Customer Order` (web/customer
  reference), `Customer Name`, `Order Date`, and `Total inc.GST`.
- Re-importing later only adds new orders — it never overwrites status, notes, or
  checklist progress already entered for an order.

A future option: connect the tracker directly (read-only) to ABM's SQL Server
database, so the order list is always live instead of needing a manual export/upload.
That needs a read-only DB login and confirmation of ABM's actual table/column names —
not yet set up.

## What staff track per order

Beyond the base ABM fields, each order has:

- **Web Order Ref** — the customer's own order reference
- **Status** — Received / Processing / Shipped / Delivered / On Hold / Cancelled
- **ETA** — manually entered expected delivery date
- **Milestones** — Payment Received, Sales Order Created, Purchase Order Created
  (with a PO number and a note for the supplier)
- **Notes** — free text
- Every change is stamped with who made it and when, and logged to a full history
  per order (click "History" on any row)

## Traffic light

Each order shows a colored dot so progress is visible at a glance:

- 🟢 **Green** — payment received, sales order created, and PO created. Order is
  flowing normally.
- 🟠 **Orange** — a milestone is still pending, or the order is cancelled but the
  cancellation checklist below isn't finished yet.
- 🔴 **Red** — order is cancelled *and* fully unwound (see checklist).

## Cancelling an order

Setting Status to **Cancelled** reveals a checklist of four steps:

1. PO deleted
2. Order cancelled with supplier
3. Refund issued
4. Sales order cancelled in ABM

These are manual checkboxes — staff tick each one off as they actually do it in the
relevant system (ABM, the supplier's portal, the payment provider). The tracker
doesn't perform these actions automatically; it just keeps a record of what's been
done, which is what turns the light red once all four are ticked.

## Day-to-day use

1. Open the tracker in a browser, type your name in the top-right field (remembered
   per-browser, no password).
2. Browse the order list — the traffic light shows what needs attention.
3. Click **Details** on a row to update milestones, PO info, ETA, or notes.
4. Change **Status** as the order progresses; set it to Cancelled to trigger the
   cancellation checklist.
5. Click **Save** to record your changes (everyone else sees them on next refresh).
6. Click **History** to see the full timeline of changes to that order.
7. Click **Import orders from Excel** whenever there's a fresh ABM export to bring in
   new orders.

## Current status

This is a working concept running locally, not yet deployed anywhere permanent. Open
decisions: whether to move to a live read-only ABM database connection instead of
manual Excel import, and where/how it should be hosted for daily use (currently it
just runs on a local machine on the office network).

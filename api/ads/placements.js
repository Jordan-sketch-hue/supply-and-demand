const { json, methodNotAllowed, withApiGuard } = require('../_lib/http');

const placements = [
  { key: 'homepage_hero', label: 'Homepage Hero Banner', page: 'Home', priority: 'highest' },
  { key: 'homepage_mid', label: 'Homepage Mid-Content Card', page: 'Home', priority: 'high' },
  { key: 'search_sidebar', label: 'Search Sidebar Sponsored Block', page: 'Search Demand', priority: 'high' },
  { key: 'browse_grid', label: 'Browse Supply Inline Slot', page: 'Browse Supply', priority: 'high' },
  { key: 'category_feature', label: 'Category Page Featured Banner', page: 'Categories', priority: 'medium' },
  { key: 'supplier_cta', label: 'Supplier CTA Companion Placement', page: 'Home / Supplier', priority: 'medium' },
  { key: 'footer_brand', label: 'Footer Brand Spotlight', page: 'Sitewide', priority: 'low' }
];

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  json(res, 200, { placements });
});

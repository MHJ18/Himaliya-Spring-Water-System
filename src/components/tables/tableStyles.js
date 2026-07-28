export const responsiveTableContainerSx = {
  width: '100%',
  maxWidth: '100%',
  overflowX: 'auto',
  scrollBehavior: 'smooth',
  overscrollBehaviorInline: 'contain',
  scrollbarGutter: 'stable',
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(47, 125, 255, .42) transparent',
  WebkitOverflowScrolling: 'touch',
  '&::-webkit-scrollbar': { width: 8, height: 8 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: 'rgba(47, 125, 255, .42)',
    borderRadius: 999,
  },
};

export const mobileOptionalCellSx = {
  display: { xs: 'none', sm: 'table-cell' },
};

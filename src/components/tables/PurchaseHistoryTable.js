import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { mobileOptionalCellSx, responsiveTableContainerSx } from './tableStyles';

function getPayment(transaction) {
  const total = Math.max(0, Number(transaction.totalAmount) || 0);
  const paid = Math.min(total, Math.max(0, Number(transaction.amountPaid) || 0));
  const due = Math.max(0, total - paid);
  return {
    total,
    paid,
    due,
    label: due <= 0.005 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
    color: due <= 0.005 ? 'success' : paid > 0 ? 'warning' : 'default',
  };
}

export default function PurchaseHistoryTable({ transactions, onDelete, deletingTransactionId }) {
  if (!transactions || !transactions.length) {
    return <Typography variant="body2" color="text.secondary">No purchases in this period.</Typography>;
  }

  const showActions = typeof onDelete === 'function';

  return (
    <>
      <Stack spacing={1.25} sx={{ display: { xs: 'flex', sm: 'none' } }}>
        {transactions.map((transaction) => {
          const payment = getPayment(transaction);
          return (
            <Box
              key={transaction.id}
              sx={{
                p: 1.5,
                bgcolor: 'action.hover',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2.5,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={850}>{transaction.bottleType}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(transaction.date)} &middot; {transaction.quantity} at {formatCurrency(transaction.pricePerBottle)}
                  </Typography>
                </Box>
                <Chip size="small" color={payment.color} variant={payment.label === 'Paid' ? 'filled' : 'outlined'} label={payment.label} />
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 1.5 }}>
                <Stack direction="row" spacing={2.25}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Gross</Typography>
                    <Typography variant="body2" fontWeight={800}>{formatCurrency(payment.total)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Paid at sale</Typography>
                    <Typography variant="body2" fontWeight={800} color="success.main">{formatCurrency(payment.paid)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Due</Typography>
                    <Typography variant="body2" fontWeight={800} color={payment.due > 0 ? 'warning.main' : 'text.primary'}>
                      {formatCurrency(payment.due)}
                    </Typography>
                  </Box>
                </Stack>
                {showActions && (
                  <Tooltip title={transaction.readOnly ? 'Portal orders are managed from Customer Orders' : 'Delete sale entry'}>
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Delete sale entry from ${formatDate(transaction.date)}`}
                        disabled={transaction.readOnly || deletingTransactionId === transaction.id}
                        onClick={() => onDelete(transaction)}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <TableContainer
        role="region"
        tabIndex={0}
        aria-label="Scrollable customer purchase history"
        sx={{ ...responsiveTableContainerSx, display: { xs: 'none', sm: 'block' }, maxHeight: 440 }}
      >
        <Table stickyHeader size="small" aria-label="Customer purchase history" sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Bottle type</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right" sx={mobileOptionalCellSx}>Unit price</TableCell>
              <TableCell align="right">Gross</TableCell>
              <TableCell align="right">Paid at sale</TableCell>
              <TableCell align="right">Balance</TableCell>
              {showActions && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((transaction) => {
              const payment = getPayment(transaction);
              return (
                <TableRow key={transaction.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(transaction.date)}</TableCell>
                  <TableCell>{transaction.bottleType}</TableCell>
                  <TableCell align="right">{transaction.quantity}</TableCell>
                  <TableCell align="right" sx={mobileOptionalCellSx}>{formatCurrency(transaction.pricePerBottle)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(payment.total)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 800 }}>{formatCurrency(payment.paid)}</TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      color={payment.color}
                      variant={payment.label === 'Paid' ? 'filled' : 'outlined'}
                      label={`${formatCurrency(payment.due)} · ${payment.label}`}
                    />
                  </TableCell>
                  {showActions && (
                    <TableCell align="right">
                      <Tooltip title={transaction.readOnly ? 'Portal orders are managed from Customer Orders' : 'Delete sale entry'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Delete sale entry from ${formatDate(transaction.date)}`}
                            disabled={transaction.readOnly || deletingTransactionId === transaction.id}
                            onClick={() => onDelete(transaction)}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

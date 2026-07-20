import React from 'react';
import {
  IconButton,
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

export default function PurchaseHistoryTable({ transactions, onDelete, deletingTransactionId }) {
  if (!transactions || !transactions.length) {
    return <Typography variant="body2" color="text.secondary">No purchases in this period.</Typography>;
  }

  const showActions = typeof onDelete === 'function';

  return (
    <TableContainer
      role="region"
      tabIndex={0}
      aria-label="Scrollable customer purchase history"
      sx={{ ...responsiveTableContainerSx, maxHeight: 440 }}
    >
      <Table stickyHeader size="small" aria-label="Customer purchase history" sx={{ minWidth: { xs: 490, sm: 620 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Bottle type</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right" sx={mobileOptionalCellSx}>Unit price</TableCell>
            <TableCell align="right">Total</TableCell>
            {showActions && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(transaction.date)}</TableCell>
              <TableCell>{transaction.bottleType}</TableCell>
              <TableCell align="right">{transaction.quantity}</TableCell>
              <TableCell align="right" sx={mobileOptionalCellSx}>{formatCurrency(transaction.pricePerBottle)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(transaction.totalAmount)}</TableCell>
              {showActions && (
                <TableCell align="right">
                  <Tooltip title="Delete sale entry">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Delete sale entry from ${formatDate(transaction.date)}`}
                        disabled={deletingTransactionId === transaction.id}
                        onClick={() => onDelete(transaction)}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

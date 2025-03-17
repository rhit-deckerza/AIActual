import { useSelector } from '../redux';
import { useAccounts } from './useAccounts';
import { useCategories } from './useCategories';
import { usePayees } from './usePayees';
import { useState, useEffect } from 'react';
import { runQuery } from 'loot-core/client/query-helpers';
import { q } from 'loot-core/shared/query';
import * as queries from 'loot-core/client/queries';

export function useUserData() {
  // Use existing hooks to access data
  const accounts = useAccounts();
  const categories = useCategories();
  const payees = usePayees();
  const [transactions, setTransactions] = useState([]);
  
  // Safely access user data
  const userData = useSelector(state => state.user?.data);
  
  useEffect(() => {
    async function fetchTransactions() {
      try {
        // This is similar to how Account.tsx fetches transactions
        // We're getting recent transactions across all accounts
        const query = queries.transactions(); // No accountId means all accounts
        
        // Limit to recent transactions (last 30 days) to avoid fetching too much
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateString = thirtyDaysAgo.toISOString().split('T')[0];
        
        const filteredQuery = query
          .filter({ date: { $gte: dateString } })
          .orderBy({ date: 'desc' })
          .select('*')  // Explicitly select all fields
          .options({ splits: 'grouped' })  // Include split transaction data
          .limit(50);
        
        const { data } = await runQuery(filteredQuery);
        
        // Process the data to ungroup transactions if needed
        // This is similar to what Account.tsx does
        const processedData = data.reduce((result, transaction) => {
          result.push(transaction);
          if (transaction.subtransactions) {
            transaction.subtransactions.forEach(sub => {
              // Add parent reference to make it easier to work with
              result.push({
                ...sub,
                parent_id: transaction.id,
                parent_payee: transaction.payee,
                parent_date: transaction.date
              });
            });
          }
          return result;
        }, []);
        
        setTransactions(processedData || []);
      } catch (error) {
        console.error('Error fetching transactions for AI context:', error);
        setTransactions([]);
      }
    }
    
    if (accounts && accounts.length > 0) {
      fetchTransactions();
    }
  }, [accounts]);
  
  // Get budget data - based on your other hooks, this might be in categories
  const budgets = categories;
  console.log({
    userData,
    accounts,
    transactions,
    payees,
    budgets: categories
  })
  return {
    accounts,
    transactions,
    payees,
    budgets: categories
  };
}

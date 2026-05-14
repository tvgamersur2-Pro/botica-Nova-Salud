/**
 * Mock Database - JSON-based data storage
 * Simula operaciones de base de datos usando archivos JSON
 */

import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(__dirname, '../data/mockData.json');

interface MockData {
  users: any[];
  suppliers: any[];
  products: any[];
  transactions: any[];
  transaction_items: any[];
  alerts: any[];
  audit_logs: any[];
  sessions: any[];
}

let dataCache: MockData | null = null;

/**
 * Lee los datos del archivo JSON
 */
export async function loadData(): Promise<MockData> {
  if (dataCache) {
    return dataCache;
  }
  
  try {
    const fileContent = await fs.readFile(DATA_FILE, 'utf-8');
    dataCache = JSON.parse(fileContent);
    return dataCache!;
  } catch (error) {
    console.error('Error loading mock data:', error);
    // Retornar estructura vacía si hay error
    dataCache = {
      users: [],
      suppliers: [],
      products: [],
      transactions: [],
      transaction_items: [],
      alerts: [],
      audit_logs: [],
      sessions: []
    };
    return dataCache;
  }
}

/**
 * Guarda los datos en el archivo JSON
 */
export async function saveData(data: MockData): Promise<void> {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    dataCache = data;
  } catch (error) {
    console.error('Error saving mock data:', error);
    throw error;
  }
}

/**
 * Simula una consulta SELECT
 */
export async function mockQuery<T = any>(
  table: keyof MockData,
  filter?: (item: any) => boolean
): Promise<T[]> {
  const data = await loadData();
  const tableData = data[table] || [];
  
  if (filter) {
    return tableData.filter(filter) as T[];
  }
  
  return tableData as T[];
}

/**
 * Simula un INSERT
 */
export async function mockInsert(
  table: keyof MockData,
  record: any
): Promise<any> {
  const data = await loadData();
  
  if (!data[table]) {
    data[table] = [];
  }
  
  (data[table] as any[]).push(record);
  await saveData(data);
  
  return record;
}

/**
 * Simula un UPDATE
 */
export async function mockUpdate(
  table: keyof MockData,
  id: string,
  updates: any
): Promise<any> {
  const data = await loadData();
  const tableData = data[table] as any[];
  
  const index = tableData.findIndex(item => item.id === id);
  
  if (index === -1) {
    throw new Error(`Record not found in ${table}`);
  }
  
  tableData[index] = { ...tableData[index], ...updates };
  await saveData(data);
  
  return tableData[index];
}

/**
 * Simula un DELETE
 */
export async function mockDelete(
  table: keyof MockData,
  id: string
): Promise<boolean> {
  const data = await loadData();
  const tableData = data[table] as any[];
  
  const index = tableData.findIndex(item => item.id === id);
  
  if (index === -1) {
    return false;
  }
  
  tableData.splice(index, 1);
  await saveData(data);
  
  return true;
}

/**
 * Limpia el caché
 */
export function clearCache(): void {
  dataCache = null;
}

/**
 * Simula una transacción (ejecuta múltiples operaciones)
 */
export async function mockTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  try {
    const result = await callback();
    return result;
  } catch (error) {
    // En una implementación real, aquí haríamos rollback
    throw error;
  }
}

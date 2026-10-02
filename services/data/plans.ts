import { collection, getDocs, limit, query } from 'firebase/firestore';
import { Plan } from '../../types';
import { db } from '../firebase';

export const getPlanList = async (): Promise<Plan[]> => {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, 'plans'), limit(100)));
  return snapshot.docs.map(plan => plan.data() as Plan);
};

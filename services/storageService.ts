import { LessonPlan } from "../types";
import { db, auth, storage } from "./firebase";
import { 
  collection, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  updateDoc 
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

const PLANS_COLLECTION = 'plans';
const USERS_COLLECTION = 'users';

// --- FUNÇÃO AUXILIAR: UPLOAD DE IMAGEM ---
const uploadImageAndGetUrl = async (base64Image: string, planId: string): Promise<string> => {
  try {
    const storageRef = ref(storage, `plans/${planId}/cover_image`);
    await uploadString(storageRef, base64Image, 'data_url');
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Erro ao fazer upload da imagem:", error);
    return "";
  }
};

// --- GERENCIAMENTO DE PLANOS DE AULA ---

export const saveLessonPlanSafely = async (newPlan: LessonPlan): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado");

    let finalImageUrl = newPlan.illustrationImage;

    if (newPlan.illustrationImage && newPlan.illustrationImage.startsWith('data:')) {
      finalImageUrl = await uploadImageAndGetUrl(newPlan.illustrationImage, newPlan.id);
    }

    const planToSave = {
      ...newPlan,
      userId: user.uid,
      illustrationImage: finalImageUrl,
      createdAt: Date.now()
    };

    await setDoc(doc(db, PLANS_COLLECTION, newPlan.id), planToSave);
    return true;
  } catch (e) {
    console.error("Erro ao salvar no banco:", e);
    alert("Erro ao salvar. Verifique sua conexão.");
    return false;
  }
};

export const getSavedPlans = async (): Promise<LessonPlan[]> => {
  try {
    // CORREÇÃO AQUI: Removemos o filtro 'where userId == ...'
    // Agora buscamos TODOS os planos da coleção
    const q = collection(db, PLANS_COLLECTION);

    const querySnapshot = await getDocs(q);
    const plans: LessonPlan[] = [];
    
    querySnapshot.forEach((doc) => {
      plans.push(doc.data() as LessonPlan);
    });
    
    // Ordena do mais recente para o mais antigo
    return plans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  } catch (e) {
    console.error("Erro ao buscar planos:", e);
    return [];
  }
};

export const getPlanById = async (id: string): Promise<LessonPlan | null> => {
  try {
    const docRef = doc(db, PLANS_COLLECTION, id);
    // Tentamos buscar direto pelo ID do documento
    const snap = await getDocs(query(collection(db, PLANS_COLLECTION), where("id", "==", id)));
    
    if (!snap.empty) {
      return snap.docs[0].data() as LessonPlan;
    }
    return null;
  } catch (e) {
    console.error("Erro ao buscar plano único:", e);
    return null;
  }
};

export const updateLessonPlan = async (id: string, updates: Partial<LessonPlan>): Promise<boolean> => {
  try {
    const docRef = doc(db, PLANS_COLLECTION, id);
    await updateDoc(docRef, updates);
    return true;
  } catch (e) {
    console.error("Erro ao atualizar:", e);
    return false;
  }
};

export const deletePlanSafely = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, PLANS_COLLECTION, id));
  } catch (e) {
    console.error("Erro ao deletar:", e);
  }
};

// --- GERENCIAMENTO DE PROFESSORES ---

export const getTeachers = async (): Promise<any[]> => {
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const teachers: any[] = [];
    snap.forEach(doc => teachers.push(doc.data()));
    return teachers;
  } catch (e) {
    console.error("Erro ao buscar professores", e);
    return [];
  }
};

export const checkUsernameUnique = async (username: string): Promise<boolean> => {
  const q = query(collection(db, USERS_COLLECTION), where("username", "==", username.toLowerCase()));
  const snap = await getDocs(q);
  return snap.empty;
};

// --- EXPORTAÇÃO ---
export const exportDatabase = async () => {
  const plans = await getSavedPlans();
  const teachers = await getTeachers();
  const data = { plans, teachers, exportDate: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `freedom_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};
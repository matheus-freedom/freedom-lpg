import { LessonPlan } from "../types";
import { db, auth, storage } from "./firebase";
import { 
  collection, 
  setDoc, 
  getDocs, 
  getDoc,
  deleteDoc, 
  doc, 
  query,
  where,
  updateDoc,
  orderBy,
  limit,
  getCountFromServer
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

const PLANS_COLLECTION = 'plans';
const USERS_COLLECTION = 'users';

// ── FUNÇÃO AUXILIAR: Remove campos undefined de um objeto ──
// O Firebase rejeita qualquer campo com valor undefined.
// Esta função percorre o objeto e remove todos esses campos antes de salvar.
const removeUndefinedFields = (obj: Record<string, any>): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
};

// ── FUNÇÃO AUXILIAR: Busca os dados do professor logado ──
// Vai à coleção 'users' no Firestore e lê o documento do usuário
// atualmente autenticado (identificado pelo seu uid do Firebase).
// Retorna o nome e o username reais cadastrados no perfil.
//
// POR QUE ISSO EXISTE:
// As telas de geração de aula não têm acesso confiável ao nome do
// professor (tentavam ler de um localStorage que ficou vazio após a
// migração para o Firebase). Centralizando a busca aqui, no ponto de
// salvamento, qualquer tela que crie uma aula passa a gravar o autor
// correto automaticamente — sem depender de cada tela acertar isso.
const getAuthorInfo = async (uid: string): Promise<{ authorName: string; authorId: string }> => {
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));

    if (userSnap.exists()) {
      const data = userSnap.data();
      const name = (data.name || "").trim();
      const username = (data.username || "").trim();

      // Monta "Nome · @username" quando ambos existem.
      // Se faltar um, usa o que houver. Se faltar os dois, cai no genérico.
      let authorName = "Freedom Teacher";
      if (name && username) {
        authorName = `${name} · ${username}`;
      } else if (name) {
        authorName = name;
      } else if (username) {
        authorName = username;
      }

      return { authorName, authorId: uid };
    }

    // Documento do usuário não encontrado em 'users' — fallback seguro.
    return { authorName: "Freedom Teacher", authorId: uid };
  } catch (e) {
    console.error("Erro ao buscar dados do autor:", e);
    return { authorName: "Freedom Teacher", authorId: uid };
  }
};

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

    // Busca o nome e username reais do professor logado, direto da
    // coleção 'users'. É a fonte mais confiável do nome.
    const { authorName, authorId } = await getAuthorInfo(user.uid);

    let finalImageUrl = newPlan.illustrationImage;

    if (newPlan.illustrationImage && newPlan.illustrationImage.startsWith('data:')) {
      finalImageUrl = await uploadImageAndGetUrl(newPlan.illustrationImage, newPlan.id);
    }

    // Montamos o objeto base e removemos todos os campos undefined
    // antes de enviar ao Firebase — isso evita o erro "Unsupported field value: undefined".
    //
    // Importante: authorName, authorId, userId e createdAt vêm DEPOIS
    // do ...newPlan, então sobrescrevem qualquer valor que tenha vindo
    // das telas (inclusive o antigo "Freedom Teacher"). Aqui é a fonte
    // da verdade para esses campos.
    const planToSave = removeUndefinedFields({
      ...newPlan,
      userId: user.uid,
      authorId: authorId,
      authorName: authorName,
      illustrationImage: finalImageUrl,
      createdAt: Date.now()
    });

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
    const q = collection(db, PLANS_COLLECTION);
    const querySnapshot = await getDocs(q);
    const plans: LessonPlan[] = [];
    
    querySnapshot.forEach((doc) => {
      plans.push(doc.data() as LessonPlan);
    });
    
    return plans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  } catch (e) {
    console.error("Erro ao buscar planos:", e);
    return [];
  }
};

// ── Últimas aulas (carrossel da Home) ──
// Diferente de getSavedPlans(), que baixa a coleção INTEIRA, aqui pedimos
// ao Firestore só as N mais recentes, já ordenadas. Custa N leituras em
// vez de centenas, e a Home abre mais rápido conforme o acervo cresce.
export const getRecentPlans = async (max = 10): Promise<LessonPlan[]> => {
  try {
    const q = query(collection(db, PLANS_COLLECTION), orderBy("createdAt", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as LessonPlan);
  } catch (e) {
    console.error("Erro ao buscar aulas recentes:", e);
    return [];
  }
};

// ── Contadores (rodapé da Home) ──
// getCountFromServer é a "consulta de agregação" do Firestore: o servidor
// conta e devolve só o número. Custa 1 leitura a cada 1000 documentos,
// em vez de baixar todos os planos só para fazer .length.
// O total pessoal usa o campo userId, gravado desde a migração para o
// Firebase; aulas muito antigas sem userId não entram nessa conta.
export const getLessonCounts = async (userId?: string): Promise<{ mine: number; global: number }> => {
  try {
    const globalSnap = await getCountFromServer(collection(db, PLANS_COLLECTION));
    let mine = 0;
    if (userId) {
      const mineSnap = await getCountFromServer(
        query(collection(db, PLANS_COLLECTION), where("userId", "==", userId))
      );
      mine = mineSnap.data().count;
    }
    return { mine, global: globalSnap.data().count };
  } catch (e) {
    console.error("Erro ao contar aulas:", e);
    return { mine: 0, global: 0 };
  }
};

export const getPlanById = async (id: string): Promise<LessonPlan | null> => {
  try {
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
    // Remove campos undefined também nas atualizações parciais
    const cleanUpdates = removeUndefinedFields(updates as Record<string, any>);
    await updateDoc(docRef, cleanUpdates);
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

// Importar os módulos do Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

// Inicializar o Firebase com o config global
const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

console.log("Firebase inicializado com sucesso!");

// Expor os objetos para uso global (se necessário)
window.firebase = { auth, database };

// Variáveis globais
let tarefas = [];
let modoVisualizacao = "lista";
let draggedItem = null;
let calendar = null;
let pomodoroInterval;
let tempoInicio = null;
let duracaoTotal = 1500; // 25 minutos em segundos
let pausado = true;
let chartInstance = null;

// Função para tocar som com fallback
function tocarSom(somId) {
  try {
    const som = document.getElementById(somId);
    if (som.readyState !== 4) {
      console.warn(`Áudio ${somId} não está carregado (readyState: ${som.readyState})`);
      mostrarToast("⚠️ Não foi possível tocar o som. Verifique os arquivos de áudio.");
      return;
    }
    som.play();
  } catch (error) {
    console.error(`Erro ao tocar ${somId}:`, error);
    mostrarToast("⚠️ Erro ao tocar o som.");
  }
}

// Função para carregar tarefas
function carregarTarefas() {
  const user = auth.currentUser;
  if (!user) {
    document.getElementById("listaTarefas").innerHTML = "";
    atualizarContador();
    return;
  }

  const tasksRef = database.ref(`tasks/${user.uid}`);
  tasksRef.on('value', snapshot => {
    tarefas = [];
    const data = snapshot.val() || {};
    Object.entries(data).forEach(([id, tarefa]) => {
      tarefas.push({ id, ...tarefa });
    });

    const lista = document.getElementById("listaTarefas");
    lista.innerHTML = "";
    const agora = new Date();

    const filtroCategoria = document.getElementById("filtroCategoria").value;
    const filtroStatus = document.getElementById("filtroStatus").value;
    const ordenarPor = document.getElementById("ordenarTarefas").value;

    let tarefasFiltradas = tarefas.filter(tarefa => {
      const categoriaMatch = filtroCategoria === "todas" || tarefa.categoria === filtroCategoria;
      const statusMatch = filtroStatus === "todas" || (filtroStatus === "pendentes" && !tarefa.feito) || (filtroStatus === "concluídas" && tarefa.feito);
      return categoriaMatch && statusMatch;
    });

    if (ordenarPor === "prazo") {
      tarefasFiltradas.sort((a, b) => new Date(a.prazo || "9999-12-31") - new Date(b.prazo || "9999-12-31"));
    } else if (ordenarPor === "prioridade") {
      const prioridadeOrdem = { alta: 1, média: 2, baixa: 3 };
      tarefasFiltradas.sort((a, b) => prioridadeOrdem[a.prioridade] - prioridadeOrdem[b.prioridade]);
    }

    tarefasFiltradas.forEach(({ id, texto, categoria, prazo, feito, recorrente, prioridade, tags }, index) => {
      const li = document.createElement("li");
      li.className = "animada";
      li.dataset.id = id;
      if (feito) li.classList.add("feito");

      if (prazo && !feito) {
        const prazoDate = new Date(prazo);
        const diffDias = Math.ceil((prazoDate - agora) / (1000 * 60 * 60 * 24));
        if (diffDias < 0) {
          li.classList.add("tarefa-vencida");
        } else if (diffDias <= 1) {
          li.classList.add("tarefa-vence-em-breve");
        }
      }

      const dataPrazo = prazo ? `<small class="prazo">⏰ ${prazo}</small>` : "";
      const dataPrioridade = prioridade ? `<small class="prioridade">Prioridade: ${prioridade}</small>` : "";
      const dataTags = tags && tags.length ? `<small class="tags">Tags: ${tags.join(", ")}</small>` : "";
      li.innerHTML = `
        <span class="${feito ? 'concluida' : ''}">${texto} <small>[${categoria}]</small> ${dataPrazo} ${dataPrioridade} ${dataTags}</span>
        <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
        <button onclick="editarTarefa(this)">✏️</button>
        <button onclick="removerTarefa(this)">🗑️</button>
        <button onclick="reagendarTarefa(this)">📅</button>
      `;
      lista.appendChild(li);
    });

    atualizarContador();
    atualizarHistorico();
    if (modoVisualizacao === "kanban") carregarTarefasKanban();
    if (modoVisualizacao === "calendario") carregarTarefasCalendario();
    atualizarGrafico();
  }, err => {
    console.error("Erro ao carregar tarefas:", err);
    mostrarToast("⚠️ Erro ao carregar tarefas!");
  });
}

// ... (o restante do script.js permanece o mesmo até o final, incluindo as funções como mostrarToast, concluirTarefa, etc.)
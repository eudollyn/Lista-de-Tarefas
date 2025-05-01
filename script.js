// Variáveis globais
let tarefas = JSON.parse(localStorage.getItem("tarefas")) || [];
let modoVisualizacao = "lista";
let draggedItem = null;
let calendar = null;
let pomodoroInterval;
let tempoInicio = null;
let duracaoTotal = 1500; // 25 minutos em segundos
let pausado = true;

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

// Função para carregar tarefas no modo Lista
function carregarTarefas() {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = "";
  tarefas = JSON.parse(localStorage.getItem("tarefas")) || [];
  tarefas.forEach(({ texto, categoria, prazo, feito, recorrente }, index) => {
    const li = document.createElement("li");
    li.className = "animada";
    li.dataset.index = index;
    if (feito) li.classList.add("feito");
    const dataPrazo = prazo ? `<small class="prazo">⏰ ${prazo}</small>` : "";
    li.innerHTML = `
      <span class="${feito ? 'concluida' : ''}">${texto} <small>[${categoria}]</small> ${dataPrazo}</span>
      <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
      <button onclick="editarTarefa(this)">✏️</button>
      <button onclick="removerTarefa(this)">🗑️</button>
      <button onclick="reagendarTarefa(this)">📅</button>
    `;
    lista.appendChild(li);
  });
  atualizarContador();
  if (modoVisualizacao === "kanban") carregarTarefasKanban();
  if (modoVisualizacao === "calendario") carregarTarefasCalendario();
}

// Função para alternar entre modos de visualização
function alternarModoVisualizacao(modo) {
  console.log(`Alternando para o modo: ${modo}`);
  const modoListaBtn = document.getElementById("modoLista");
  const modoKanbanBtn = document.getElementById("modoKanban");
  const modoCalendarioBtn = document.getElementById("modoCalendario");

  if (!modoListaBtn || !modoKanbanBtn || !modoCalendarioBtn) {
    console.error("Um ou mais botões de modo não foram encontrados!");
    return;
  }

  modoListaBtn.classList.remove("modo-ativo");
  modoKanbanBtn.classList.remove("modo-ativo");
  modoCalendarioBtn.classList.remove("modo-ativo");

  const listaTarefas = document.getElementById("listaTarefas");
  const kanbanView = document.getElementById("kanbanView");
  const calendarioView = document.getElementById("calendarioView");

  if (!listaTarefas || !kanbanView || !calendarioView) {
    console.error("Uma ou mais seções de visualização não foram encontradas!");
    return;
  }

  listaTarefas.style.display = "none";
  kanbanView.style.display = "none";
  calendarioView.style.display = "none";

  if (modo === "lista") {
    console.log("Exibindo modo Lista");
    listaTarefas.style.display = "block";
    modoListaBtn.classList.add("modo-ativo");
    carregarTarefas();
  } else if (modo === "kanban") {
    console.log("Exibindo modo Kanban");
    kanbanView.style.display = "flex";
    modoKanbanBtn.classList.add("modo-ativo");
    carregarTarefasKanban();
  } else if (modo === "calendario") {
    console.log("Exibindo modo Calendário");
    calendarioView.style.display = "block";
    modoCalendarioBtn.classList.add("modo-ativo");
    carregarTarefasCalendario();
  }

  modoVisualizacao = modo;
}

// Função para carregar tarefas no modo Kanban
function carregarTarefasKanban() {
  try {
    const aFazer = document.querySelector("#aFazer .kanban-tasks");
    const emProgresso = document.querySelector("#emProgresso .kanban-tasks");
    const concluido = document.querySelector("#concluido .kanban-tasks");

    if (!aFazer || !emProgresso || !concluido) {
      console.error("Uma ou mais colunas do Kanban não foram encontradas!");
      return;
    }

    aFazer.innerHTML = "";
    emProgresso.innerHTML = "";
    concluido.innerHTML = "";

    tarefas.forEach((tarefa, index) => {
      const li = document.createElement("li");
      li.className = "animada";
      li.draggable = true;
      li.dataset.index = index;
      if (tarefa.feito) li.classList.add("feito");
      const dataPrazo = tarefa.prazo ? `<small class="prazo">⏰ ${tarefa.prazo}</small>` : "";
      li.innerHTML = `
        <span class="${tarefa.feito ? 'concluida' : ''}">${tarefa.texto} <small>[${tarefa.categoria}]</small> ${dataPrazo}</span>
        <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
        <button onclick="editarTarefa(this)">✏️</button>
        <button onclick="removerTarefa(this)">🗑️</button>
        <button onclick="reagendarTarefa(this)">📅</button>
      `;
      li.addEventListener("dragstart", dragStart);
      li.addEventListener("dragend", dragEnd);

      if (tarefa.feito) {
        concluido.appendChild(li);
      } else if (tarefa.emProgresso) {
        emProgresso.appendChild(li);
      } else {
        aFazer.appendChild(li);
      }
    });
  } catch (error) {
    console.error("Erro ao carregar tarefas no modo Kanban:", error);
  }
}

// Funções de Drag and Drop para o Kanban
function dragStart(event) {
  draggedItem = event.target;
  setTimeout(() => {
    event.target.style.opacity = "0.5";
  }, 0);
}

function dragEnd(event) {
  draggedItem.style.opacity = "1";
  draggedItem = null;
}

function allowDrop(event) {
  event.preventDefault();
}

function drop(event) {
  event.preventDefault();
  const targetColumn = event.target.closest(".kanban-column").id;
  const index = draggedItem.dataset.index;

  tarefas[index].emProgresso = targetColumn === "emProgresso";
  tarefas[index].feito = targetColumn === "concluido";

  if (tarefas[index].feito) {
    draggedItem.classList.add("feito");
    draggedItem.querySelector("span").classList.add("concluida");
    tocarSom("somAdicionar");
  } else {
    draggedItem.classList.remove("feito");
    draggedItem.querySelector("span").classList.remove("concluida");
  }

  localStorage.setItem("tarefas", JSON.stringify(tarefas));
  carregarTarefasKanban();
  atualizarContador();
  atualizarGrafico();
}

// Função para carregar tarefas no modo Calendário
function carregarTarefasCalendario() {
  try {
    const calendarEl = document.getElementById("calendario");
    if (!calendarEl) {
      console.error("Elemento do calendário não encontrado!");
      return;
    }

    if (calendar) {
      calendar.destroy();
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      events: tarefas
        .filter(tarefa => tarefa.prazo)
        .map(tarefa => ({
          title: tarefa.texto,
          start: tarefa.prazo,
          allDay: true,
          backgroundColor: tarefa.feito ? "#4CAF50" : "#FF9900",
        })),
      eventClick: function(info) {
        alert(`Tarefa: ${info.event.title}\nPrazo: ${info.event.start.toISOString().split("T")[0]}`);
      },
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,dayGridWeek",
      },
    });

    calendar.render();
  } catch (error) {
    console.error("Erro ao carregar tarefas no modo Calendário:", error);
  }
}

// Função para adicionar tarefa
function adicionarTarefa() {
  const inputTarefa = document.getElementById("novaTarefa");
  const categoria = document.getElementById("categoria").value;
  const prazo = document.getElementById("prazoTarefa").value;
  const recorrente = document.getElementById("tarefaRecorrente").checked;
  const texto = inputTarefa.value.trim();

  if (!texto) {
    alert("⚠️ Por favor, insira uma descrição para a tarefa!");
    return;
  }

  tocarSom("somAdicionar");

  tarefas.push({ texto, categoria, prazo, feito: false, recorrente, emProgresso: false });
  localStorage.setItem("tarefas", JSON.stringify(tarefas));

  inputTarefa.value = "";
  document.getElementById("prazoTarefa").value = "";
  document.getElementById("tarefaRecorrente").checked = false;

  carregarTarefas();
  atualizarContador();
  atualizarGrafico();
  mostrarToast("✅ Tarefa adicionada com sucesso!");
}

// Função para concluir tarefa
function concluirTarefa(btn) {
  const li = btn.parentElement;
  const index = li.dataset.index;
  tarefas[index].feito = !tarefas[index].feito;
  tarefas[index].emProgresso = false;

  if (tarefas[index].feito) {
    tocarSom("somAdicionar");
  }

  if (tarefas[index].feito && tarefas[index].recorrente) {
    const { texto, categoria, prazo } = tarefas[index];
    let novoPrazo = "";
    if (prazo) {
      const prazoDate = new Date(prazo);
      prazoDate.setDate(prazoDate.getDate() + 1);
      novoPrazo = prazoDate.toISOString().split("T")[0];
    }
    tarefas.push({ texto, categoria, prazo: novoPrazo, feito: false, recorrente: true, emProgresso: false });
  }

  localStorage.setItem("tarefas", JSON.stringify(tarefas));
  carregarTarefas();
  atualizarContador();
  atualizarGrafico();
  filtrarTarefas();
  ordenarTarefas();
}

// Função para remover tarefa
function removerTarefa(btn) {
  const li = btn.parentElement;
  const index = li.dataset.index;

  tocarSom("somRemover");

  tarefas.splice(index, 1);
  localStorage.setItem("tarefas", JSON.stringify(tarefas));
  carregarTarefas();
  atualizarContador();
  atualizarGrafico();
  filtrarTarefas();
  ordenarTarefas();
}

// Função para reagendar tarefa
function reagendarTarefa(btn) {
  const li = btn.parentElement;
  const index = li.dataset.index;
  const novoPrazo = prompt("Digite o novo prazo (formato: AAAA-MM-DD):");
  if (novoPrazo) {
    tarefas[index].prazo = novoPrazo;
    localStorage.setItem("tarefas", JSON.stringify(tarefas));
    carregarTarefas();
    atualizarGrafico();
    filtrarTarefas();
    ordenarTarefas();
  }
}

// Função para editar tarefa
function editarTarefa(btn) {
  const li = btn.parentElement;
  const index = li.dataset.index;
  const tarefa = tarefas[index];

  const novoTexto = prompt("Editar tarefa:", tarefa.texto);
  if (novoTexto === null || novoTexto.trim() === "") return;

  const novaCategoria = prompt("Nova categoria (Pessoal, Trabalho, Estudos, Outros):", tarefa.categoria);
  const novoPrazo = prompt("Novo prazo (formato AAAA-MM-DD, deixe vazio para remover):", tarefa.prazo);

  tarefas[index].texto = novoTexto;
  tarefas[index].categoria = novaCategoria || tarefa.categoria;
  tarefas[index].prazo = novoPrazo || "";

  localStorage.setItem("tarefas", JSON.stringify(tarefas));
  carregarTarefas();
  atualizarGrafico();
  filtrarTarefas();
  ordenarTarefas();
}

// Função para atualizar o contador
function atualizarContador() {
  const total = tarefas.length;
  const pendentes = tarefas.filter(t => !t.feito).length;
  document.getElementById("total").textContent = `Total: ${total}`;
  document.getElementById("pendentes").textContent = `Pendentes: ${pendentes}`;
}

// Função para mostrar toast
function mostrarToast(mensagem) {
  const toast = document.getElementById("toast");
  toast.textContent = mensagem;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Função para solicitar permissão de notificações
function solicitarPermissaoNotificacoes() {
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

// Função para verificar prazos
function verificarPrazos() {
  const hoje = new Date().toISOString().split("T")[0];
  tarefas.forEach(tarefa => {
    if (tarefa.prazo && tarefa.prazo === hoje && !tarefa.feito) {
      if (Notification.permission === "granted") {
        new Notification(`⏰ Lembrete: "${tarefa.texto}" vence hoje!`);
      }
    }
  });
}

// Função para atualizar o gráfico
let chartInstance = null;

function atualizarGrafico() {
  const ctx = document.getElementById("graficoTarefas").getContext("2d");
  const categorias = ["Pessoal", "Trabalho", "Estudos", "Outros"];
  const concluidasPorCategoria = categorias.map(categoria =>
    tarefas.filter(t => t.categoria === categoria && t.feito).length
  );

  // Destruir o gráfico existente, se houver
  if (chartInstance) {
    chartInstance.destroy();
  }

  // Criar um novo gráfico
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: categorias,
      datasets: [{
        label: "Tarefas Concluídas",
        data: concluidasPorCategoria,
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Função para alternar tema
function alternarTema() {
  const root = document.documentElement;
  const temaAtual = root.classList.contains("tema-claro") ? "claro" : "escuro";
  if (temaAtual === "claro") {
    root.classList.remove("tema-claro");
    localStorage.setItem("tema", "escuro");
    mostrarToast("Tema alterado para escuro!");
  } else {
    root.classList.add("tema-claro");
    localStorage.setItem("tema", "claro");
    mostrarToast("Tema alterado para claro!");
  }
}

// Função para carregar tema
function carregarTema() {
  const temaSalvo = localStorage.getItem("tema") || "escuro";
  const root = document.documentElement;
  if (temaSalvo === "claro") {
    root.classList.add("tema-claro");
  } else {
    root.classList.remove("tema-claro");
  }
}

// Função para exportar como TXT
function exportarTXT() {
  const texto = tarefas.map(t => `${t.texto} [${t.categoria}] ${t.prazo ? `⏰ ${t.prazo}` : ''} ${t.feito ? '✔️' : ''}`).join("\n");
  const blob = new Blob([texto], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tarefas.txt";
  a.click();
  URL.revokeObjectURL(url);
}

// Função para exportar como PDF
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Minha Lista de Tarefas", 10, 10);
  let y = 20;
  tarefas.forEach(t => {
    doc.text(`${t.texto} [${t.categoria}] ${t.prazo ? `⏰ ${t.prazo}` : ''} ${t.feito ? '✔️' : ''}`, 10, y);
    y += 10;
  });
  doc.save("tarefas.pdf");
}

// Função para exportar como Excel
function exportarExcel() {
  console.log("Iniciando exportação para Excel...");
  if (!tarefas || tarefas.length === 0) {
    mostrarToast("Nenhuma tarefa para exportar!");
    console.log("Nenhuma tarefa disponível.");
    return;
  }

  if (typeof XLSX === "undefined") {
    mostrarToast("⚠️ Biblioteca SheetJS não carregada!");
    console.error("SheetJS não está disponível. Verifique o carregamento do script.");
    return;
  }

  try {
    console.log("Formatando dados para Excel...");
    const dadosExcel = tarefas
      .filter(tarefa => tarefa && typeof tarefa === "object")
      .map(tarefa => ({
        Tarefa: tarefa.texto || "Sem descrição",
        Categoria: tarefa.categoria || "Sem categoria",
        Prazo: tarefa.prazo || "Sem prazo",
        Status: tarefa.feito ? "Concluída" : "Pendente",
        Recorrente: tarefa.recorrente ? "Sim" : "Não"
      }));

    if (dadosExcel.length === 0) {
      mostrarToast("⚠️ Nenhuma tarefa válida para exportar!");
      console.log("Nenhuma tarefa válida após filtragem.");
      return;
    }

    console.log("Dados formatados:", dadosExcel);
    const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
    console.log("Planilha criada:", worksheet);

    worksheet['!cols'] = [
      { wch: 30 }, // Tarefa
      { wch: 15 }, // Categoria
      { wch: 15 }, // Prazo
      { wch: 10 }, // Status
      { wch: 10 }  // Recorrente
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tarefas");
    console.log("Workbook criado:", workbook);

    // Substituir XLSX.write por XLSX.writeFile
    XLSX.writeFile(workbook, "Lista_de_Tarefas.xlsx");
    console.log("Download iniciado.");
    mostrarToast("✅ Tarefas exportadas para Excel!");
  } catch (error) {
    console.error("Erro ao exportar para Excel:", error);
    mostrarToast("⚠️ Erro ao exportar para Excel: " + error.message);
  }
}

// Função para limpar tudo
function limparTudo() {
  if (confirm("Tem certeza que deseja limpar todas as tarefas?")) {
    localStorage.removeItem("tarefas");
    tarefas = [];
    carregarTarefas();
    atualizarContador();
    atualizarGrafico();
    mostrarToast("🗑️ Todas as tarefas foram removidas!");
  }
}

// Função para filtrar tarefas
function filtrarTarefas() {
  const filtro = document.getElementById("filtroCategoria").value;
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = "";
  const tarefasFiltradas = filtro === "todas" ? tarefas : tarefas.filter(t => t.categoria === filtro);
  tarefasFiltradas.forEach(({ texto, categoria, prazo, feito }, index) => {
    const li = document.createElement("li");
    li.className = "animada";
    li.dataset.index = index;
    if (feito) li.classList.add("feito");
    const dataPrazo = prazo ? `<small class="prazo">⏰ ${prazo}</small>` : "";
    li.innerHTML = `
      <span class="${feito ? 'concluida' : ''}">${texto} <small>[${categoria}]</small> ${dataPrazo}</span>
      <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
      <button onclick="editarTarefa(this)">✏️</button>
      <button onclick="removerTarefa(this)">🗑️</button>
      <button onclick="reagendarTarefa(this)">📅</button>
    `;
    lista.appendChild(li);
  });
}

// Função para ordenar tarefas
function ordenarTarefas() {
  const ordenacao = document.getElementById("ordenarTarefas").value;
  if (ordenacao === "prazo") {
    tarefas.sort((a, b) => {
      if (!a.prazo && !b.prazo) return 0;
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return new Date(a.prazo) - new Date(b.prazo);
    });
  }
  localStorage.setItem("tarefas", JSON.stringify(tarefas));
  carregarTarefas();
  filtrarTarefas();
}

// Função para iniciar o Pomodoro
function iniciarPomodoro() {
  if (!pausado) return;
  pausado = false;
  document.querySelector(".pomodoro").classList.remove("pausado");

  if (tempoInicio === null) {
    const minutos = parseInt(document.getElementById("entradaMinutos").value) || 25;
    duracaoTotal = minutos * 60;
    tempoInicio = Date.now();
  } else {
    tempoInicio = Date.now() - (duracaoTotal - Math.floor(duracaoTotal));
  }

  atualizarTempo();
  pomodoroInterval = setInterval(() => {
    if (!pausado) {
      const tempoDecorrido = Math.floor((Date.now() - tempoInicio) / 1000);
      const tempoRestante = duracaoTotal - tempoDecorrido;
      if (tempoRestante <= 0) {
        clearInterval(pomodoroInterval);
        pausado = true;
        document.getElementById("pararAlarme").style.display = "block";
        document.getElementById("pomodoroAlarm").play().catch(error => {
          console.error("Erro ao tocar alarme:", error);
        });
        document.querySelector(".pomodoro").classList.add("pausado");
        atualizarTempo();
        return;
      }
      atualizarTempo();
    }
  }, 1000);
}

// Função para pausar o Pomodoro
function pausarPomodoro() {
  if (!pausado) {
    pausado = true;
    clearInterval(pomodoroInterval);
    const tempoDecorrido = Math.floor((Date.now() - tempoInicio) / 1000);
    duracaoTotal = duracaoTotal - tempoDecorrido;
    document.querySelector(".pomodoro").classList.add("pausado");
    atualizarTempo();
  }
}

// Função para resetar o Pomodoro
function resetarPomodoro() {
  clearInterval(pomodoroInterval);
  pausado = true;
  const minutos = parseInt(document.getElementById("entradaMinutos").value) || 25;
  duracaoTotal = minutos * 60;
  tempoInicio = null;
  document.querySelector(".pomodoro").classList.add("pausado");
  atualizarTempo();
  document.getElementById("pararAlarme").style.display = "none";
  document.getElementById("pomodoroAlarm").pause();
  document.getElementById("pomodoroAlarm").currentTime = 0;
}

// Função para parar o alarme do Pomodoro
function pararAlarme() {
  document.getElementById("pomodoroAlarm").pause();
  document.getElementById("pomodoroAlarm").currentTime = 0;
  document.getElementById("pararAlarme").style.display = "none";
}

// Função para atualizar o tempo do Pomodoro
function atualizarTempo() {
  let minutos = 0;
  let segundos = 0;
  if (!pausado && tempoInicio !== null) {
    const tempoDecorrido = Math.floor((Date.now() - tempoInicio) / 1000);
    const tempoRestante = Math.max(0, duracaoTotal - tempoDecorrido);
    minutos = Math.floor(tempoRestante / 60);
    segundos = tempoRestante % 60;
  } else {
    minutos = Math.floor(duracaoTotal / 60);
    segundos = duracaoTotal % 60;
  }
  document.getElementById("tempo").textContent = `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`;
}

// Função para mostrar ajuda sobre tarefas recorrentes
function mostrarAjudaRecorrente() {
  alert("ℹ️ Tarefas Recorrentes:\nUma tarefa recorrente é automaticamente recriada após ser concluída. Se tiver um prazo, o novo prazo será o dia seguinte ao original. Útil para hábitos ou tarefas diárias, como 'Beber água' ou 'Estudar 1 hora'.");
}

// Inicialização
document.addEventListener("DOMContentLoaded", function() {
  console.log("Inicializando aplicação...");
  carregarTarefas();
  solicitarPermissaoNotificacoes();
  mostrarToast("🎉 Bem-vindo à sua lista de tarefas!");
  carregarTema();
  verificarPrazos();
  setInterval(verificarPrazos, 60000);

  // Ouvintes de eventos
  document.getElementById("adicionarTarefa").addEventListener("click", adicionarTarefa);
  document.getElementById("iniciarPomodoro").addEventListener("click", iniciarPomodoro);
  document.getElementById("pausarPomodoro").addEventListener("click", pausarPomodoro);
  document.getElementById("resetarPomodoro").addEventListener("click", resetarPomodoro);
  document.getElementById("pararAlarme").addEventListener("click", pararAlarme);
  document.getElementById("exportarTXT").addEventListener("click", exportarTXT);
  document.getElementById("exportarPDF").addEventListener("click", exportarPDF);
  document.getElementById("exportarExcel").addEventListener("click", exportarExcel);
  document.getElementById("limparTudo").addEventListener("click", limparTudo);
  document.getElementById("alternarTema").addEventListener("click", alternarTema);
  document.getElementById("filtroCategoria").addEventListener("change", filtrarTarefas);
  document.getElementById("ordenarTarefas").addEventListener("change", ordenarTarefas);
  document.getElementById("modoLista").addEventListener("click", () => alternarModoVisualizacao("lista"));
  document.getElementById("modoKanban").addEventListener("click", () => alternarModoVisualizacao("kanban"));
  document.getElementById("modoCalendario").addEventListener("click", () => alternarModoVisualizacao("calendario"));
  document.getElementById("ajudaRecorrente").addEventListener("click", (event) => {
    event.stopPropagation();
    mostrarAjudaRecorrente();
  });

  // Atualizar duração do Pomodoro quando entradaMinutos mudar
  document.getElementById("entradaMinutos").addEventListener("change", () => {
    if (pausado && tempoInicio === null) {
      const minutos = parseInt(document.getElementById("entradaMinutos").value) || 25;
      duracaoTotal = minutos * 60;
      atualizarTempo();
    }
  });

  // Atualizar tempo ao voltar para a aba
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !pausado && tempoInicio !== null) {
      atualizarTempo();
    }
  });

  // Verificar áudios
  console.log("somAdicionar carregado:", document.getElementById("somAdicionar").readyState === 4 ? "Sim" : "Não");
  console.log("somRemover carregado:", document.getElementById("somRemover").readyState === 4 ? "Sim" : "Não");

  atualizarGrafico();
  console.log("Inicialização concluída!");
});
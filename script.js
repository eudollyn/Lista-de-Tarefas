// Variáveis globais
let tarefas = JSON.parse(localStorage.getItem("tarefas")) || [];
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

// Função para carregar tarefas no modo Lista
function carregarTarefas() {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = "";
  tarefas = JSON.parse(localStorage.getItem("tarefas")) || [];
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

  tarefasFiltradas.forEach(({ texto, categoria, prazo, feito, recorrente, prioridade, tags }, index) => {
    const li = document.createElement("li");
    li.className = "animada";
    li.dataset.index = index;
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
    const agora = new Date();

    tarefas.forEach((tarefa, index) => {
      const li = document.createElement("li");
      li.className = "animada";
      li.draggable = true;
      li.dataset.index = index;
      if (tarefa.feito) li.classList.add("feito");

      // Verificar prazo para destacar
      if (tarefa.prazo && !tarefa.feito) {
        const prazoDate = new Date(tarefa.prazo);
        const diffDias = Math.ceil((prazoDate - agora) / (1000 * 60 * 60 * 24));
        if (diffDias < 0) {
          li.classList.add("tarefa-vencida");
        } else if (diffDias <= 1) {
          li.classList.add("tarefa-vence-em-breve");
        }
      }

      const dataPrazo = tarefa.prazo ? `<small class="prazo">⏰ ${tarefa.prazo}</small>` : "";
      const dataPrioridade = tarefa.prioridade ? `<small class="prioridade">Prioridade: ${tarefa.prioridade}</small>` : "";
      li.innerHTML = `
        <span class="${tarefa.feito ? 'concluida' : ''}">${tarefa.texto} <small>[${tarefa.categoria}]</small> ${dataPrazo} ${dataPrioridade}</span>
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
  const prioridade = document.getElementById("prioridadeTarefa").value;
  const tagsInput = document.getElementById("tagsTarefa").value;
  const texto = inputTarefa.value.trim();

  if (!texto) {
    alert("⚠️ Por favor, insira uma descrição para a tarefa!");
    return;
  }

  if (!categoria) {
    alert("⚠️ Por favor, selecione uma categoria!");
    return;
  }

  if (!prioridade) {
    alert("⚠️ Por favor, selecione uma prioridade!");
    return;
  }

  tocarSom("somAdicionar");

  const tags = tagsInput.split(",").map(tag => tag.trim()).filter(tag => tag);
  const novaTarefa = {
    texto,
    categoria,
    prazo: prazo || null,
    feito: false,
    recorrente,
    emProgresso: false,
    prioridade,
    tags,
    historico: [{
      acao: "Criada",
      data: new Date().toISOString()
    }]
  };
  tarefas.push(novaTarefa);
  localStorage.setItem("tarefas", JSON.stringify(tarefas));

  inputTarefa.value = "";
  document.getElementById("tagsTarefa").value = "";
  document.getElementById("prazoTarefa").value = "";
  document.getElementById("tarefaRecorrente").checked = false;

  carregarTarefas();
  atualizarContador();
  atualizarGrafico();
  tocarSom("somAdicionar");
  mostrarToast("✅ Tarefa adicionada com sucesso!");
}

// Função para concluir tarefa
function concluirTarefa(btn) {
  const li = btn.parentElement;
  const index = li.dataset.index;
  tarefas[index].feito = !tarefas[index].feito;
  tarefas[index].emProgresso = false;

  tarefas[index].historico.push({
    acao: tarefas[index].feito ? "Concluída" : "Marcada como pendente",
    data: new Date().toISOString()
  });

  if (tarefas[index].feito) {
    tocarSom("somAdicionar");
  }

  if (tarefas[index].feito && tarefas[index].recorrente) {
    const { texto, categoria, prazo, prioridade } = tarefas[index];
    let novoPrazo = "";
    if (prazo) {
      const prazoDate = new Date(prazo);
      prazoDate.setDate(prazoDate.getDate() + 1);
      novoPrazo = prazoDate.toISOString().split("T")[0];
    }
    tarefas.push({
      texto,
      categoria,
      prazo: novoPrazo,
      feito: false,
      recorrente: true,
      emProgresso: false,
      prioridade,
      historico: [{
        acao: "Criada (recorrente)",
        data: new Date().toISOString()
      }]
    });
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

  tarefas[index].historico.push({
    acao: "Removida",
    data: new Date().toISOString()
  });

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
    tarefas[index].historico.push({
      acao: "Prazo alterado para " + novoPrazo,
      data: new Date().toISOString()
    });
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
  const novaPrioridade = prompt("Nova prioridade (baixa, média, alta):", tarefa.prioridade);

  tarefas[index].texto = novoTexto;
  tarefas[index].categoria = novaCategoria || tarefa.categoria;
  tarefas[index].prazo = novoPrazo || "";
  tarefas[index].prioridade = novaPrioridade || tarefa.prioridade;

  tarefas[index].historico.push({
    acao: "Editada",
    data: new Date().toISOString()
  });

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
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Permissão para notificações concedida!');
        mostrarToast('✅ Permissão para notificações concedida!');
      } else {
        console.log('Permissão para notificações negada.');
        mostrarToast('⚠️ Permissão para notificações negada.');
      }
    });
  }
}

// Função para verificar prazos (atualizada para Notificações de Prazo)
function verificarPrazos() {
  const agora = new Date();
  tarefas.forEach(tarefa => {
    if (tarefa.prazo && !tarefa.feito) {
      const prazoDate = new Date(tarefa.prazo);
      const diffHoras = (prazoDate - agora) / (1000 * 60 * 60);
      if (diffHoras <= 0) {
        mostrarToast(`⚠️ A tarefa "${tarefa.texto}" está vencida!`);
      } else if (diffHoras <= 24) {
        mostrarToast(`⏰ A tarefa "${tarefa.texto}" vence em breve!`);
        // Enviar notificação push
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('Tarefa Perto de Vencer', {
              body: `A tarefa "${tarefa.texto}" vence em breve!`,
              icon: './icon.png',
            });
          });
        }
      }
    }
  });
}

// Função para atualizar o gráfico
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
  if (tarefas.length === 0) {
    mostrarToast("⚠️ Não há tarefas para exportar!");
    return;
  }
  const texto = tarefas.map(t => `${t.texto} [${t.categoria}] ${t.prazo ? `⏰ ${t.prazo}` : ''} ${t.feito ? '✔️' : ''}`).join("\n");
  const blob = new Blob([texto], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tarefas.txt";
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast("✅ Tarefas exportadas para TXT!");
}

// Função para exportar como PDF
function exportarPDF() {
  if (tarefas.length === 0) {
    mostrarToast("⚠️ Não há tarefas para exportar!");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Minha Lista de Tarefas", 10, 10);
  let y = 20;
  tarefas.forEach(t => {
    doc.text(`${t.texto} [${t.categoria}] ${t.prazo ? `⏰ ${t.prazo}` : ''} ${t.feito ? '✔️' : ''}`, 10, y);
    y += 10;
  });
  doc.save("tarefas.pdf");
  mostrarToast("✅ Tarefas exportadas para PDF!");
}

// Função para exportar como Excel (atualizada para Exportação Filtrada)
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
    const filtroCategoria = document.getElementById("filtroCategoria").value;
    const filtroStatus = document.getElementById("filtroStatus").value || "todas";
    let tarefasFiltradas = tarefas;

    // Filtro por categoria
    if (filtroCategoria && filtroCategoria !== "todas") {
      tarefasFiltradas = tarefasFiltradas.filter(t => t.categoria === filtroCategoria);
    }

    // Filtro por status (pendente, concluída, todas)
    if (filtroStatus && filtroStatus !== "todas") {
      tarefasFiltradas = tarefasFiltradas.filter(t => 
        filtroStatus === "concluídas" ? t.feito : !t.feito
      );
    }

    const dadosExcel = tarefasFiltradas
      .filter(tarefa => tarefa && typeof tarefa === "object")
      .map(tarefa => ({
        Tarefa: tarefa.texto || "Sem descrição",
        Categoria: tarefa.categoria || "Sem categoria",
        Prazo: tarefa.prazo || "Sem prazo",
        Status: tarefa.feito ? "Concluída" : "Pendente",
        Recorrente: tarefa.recorrente ? "Sim" : "Não",
        Prioridade: tarefa.prioridade || "Média"
      }));

    if (dadosExcel.length === 0) {
      mostrarToast("⚠️ Nenhuma tarefa válida para exportar com os filtros aplicados!");
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
      { wch: 10 }, // Recorrente
      { wch: 10 }  // Prioridade
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tarefas");
    console.log("Workbook criado:", workbook);

    XLSX.writeFile(workbook, "Lista_de_Tarefas_Filtrada.xlsx");
    console.log("Download iniciado.");
    mostrarToast("✅ Tarefas filtradas exportadas para Excel!");
  } catch (error) {
    console.error("Erro ao exportar para Excel:", error);
    mostrarToast("⚠️ Erro ao exportar para Excel: " + error.message);
  }
}

// Função para limpar tudo
function limparTudo() {
  if (tarefas.length === 0) {
    mostrarToast("⚠️ Não há tarefas para limpar!");
    return;
  }
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
  const filtroCategoria = document.getElementById("filtroCategoria").value;
  const filtroStatus = document.getElementById("filtroStatus").value || "todas";
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = "";
  const agora = new Date();

  let tarefasFiltradas = tarefas;
  if (filtroCategoria !== "todas") {
    tarefasFiltradas = tarefasFiltradas.filter(t => t.categoria === filtroCategoria);
  }
  if (filtroStatus !== "todas") {
    tarefasFiltradas = tarefasFiltradas.filter(t => 
      filtroStatus === "concluídas" ? t.feito : !t.feito
    );
  }

  tarefasFiltradas.forEach(({ texto, categoria, prazo, feito, prioridade }, index) => {
    const li = document.createElement("li");
    li.className = "animada";
    li.dataset.index = index;
    if (feito) li.classList.add("feito");

    // Verificar prazo para destacar
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
    li.innerHTML = `
      <span class="${feito ? 'concluida' : ''}">${texto} <small>[${categoria}]</small> ${dataPrazo} ${dataPrioridade}</span>
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
  } else if (ordenacao === "prioridade") {
    const prioridadeOrdem = { alta: 3, média: 2, baixa: 1 };
    tarefas.sort((a, b) => prioridadeOrdem[b.prioridade] - prioridadeOrdem[a.prioridade]);
  }
  localStorage.setItem("tarefas", JSON.stringify(tarefas));
  carregarTarefas();
  filtrarTarefas();
}

// Função para atualizar o histórico
function atualizarHistorico() {
  const listaHistorico = document.getElementById("listaHistorico");
  listaHistorico.innerHTML = "";
  
  tarefas.forEach(tarefa => {
    tarefa.historico.forEach(evento => {
      const li = document.createElement("li");
      const dataFormatada = new Date(evento.data).toLocaleString("pt-BR");
      li.textContent = `[${dataFormatada}] Tarefa "${tarefa.texto}": ${evento.acao}`;
      listaHistorico.appendChild(li);
    });
  });
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

  // Pedir permissão para notificações
  solicitarPermissaoNotificacoes();

  carregarTarefas();
  mostrarToast("🎉 Bem-vindo à sua lista de tarefas!");
  carregarTema();
  verificarPrazos();
  setInterval(verificarPrazos, 60000); // Verifica prazos a cada 60 segundos

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
  document.getElementById("filtroStatus").addEventListener("change", filtrarTarefas);
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

// Atualizar tempo ao voltar para a aba
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !pausado && tempoInicio !== null) {
      atualizarTempo();
    }
  });

document.addEventListener("keydown", (e) => {
  // Adicionar tarefa ao pressionar Enter
  if (e.key === "Enter" && document.activeElement === document.getElementById("novaTarefa")) {
    adicionarTarefa();
  }
  // Iniciar/pausar Pomodoro com Espaço
  if (e.key === " " && !e.target.matches("input, select")) {
    e.preventDefault();
    if (pausado) {
      iniciarPomodoro();
    } else {
      pausarPomodoro();
    }
  }
  // Limpar tudo com Ctrl + Shift + L
  if (e.ctrlKey && e.shiftKey && e.key === "L") {
    limparTudo();
  }
});

document.getElementById("corPrimaria").addEventListener("input", (e) => {
  document.documentElement.style.setProperty("--primary", e.target.value);
  localStorage.setItem("corPrimaria", e.target.value);
});

document.getElementById("corFundo").addEventListener("input", (e) => {
  document.documentElement.style.setProperty("--background", e.target.value);
  localStorage.setItem("corFundo", e.target.value);
});

// Carregar cores salvas ao iniciar
document.addEventListener("DOMContentLoaded", () => {
  const corPrimariaSalva = localStorage.getItem("corPrimaria") || "#ff6347";
  const corFundoSalva = localStorage.getItem("corFundo") || "#1a1a1a";
  document.documentElement.style.setProperty("--primary", corPrimariaSalva);
  document.documentElement.style.setProperty("--background", corFundoSalva);
  document.getElementById("corPrimaria").value = corPrimariaSalva;
  document.getElementById("corFundo").value = corFundoSalva;
  // ... resto do código
});

  // Verificar áudios
  console.log("somAdicionar carregado:", document.getElementById("somAdicionar").readyState === 4 ? "Sim" : "Não");
  console.log("somRemover carregado:", document.getElementById("somRemover").readyState === 4 ? "Sim" : "Não");

  atualizarGrafico();
  console.log("Inicialização concluída!");
});
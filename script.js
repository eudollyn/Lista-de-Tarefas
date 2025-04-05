let tarefas = [];

function salvarTarefas() {
  localStorage.setItem("tarefas", JSON.stringify(tarefas));
}

function carregarTarefas() {
  const dados = localStorage.getItem("tarefas");
  if (dados) {
    tarefas = JSON.parse(dados);
    tarefas.forEach(t => criarElementoTarefa(t.texto, t.concluida));
  }
}

function criarElementoTarefa(texto, concluida = false, categoria = "Outros") {
  const li = document.createElement("li");
  li.textContent = texto;
  if (concluida) li.classList.add("concluida");

  const tag = document.createElement("span");
  tag.className = "categoria-tag";
  tag.textContent = categoria;
  li.appendChild(tag);

  li.addEventListener("click", () => {
    li.classList.toggle("concluida");
    const index = Array.from(li.parentNode.children).indexOf(li);
    tarefas[index].concluida = li.classList.contains("concluida");
    salvarTarefas();
  });

  const btnExcluir = document.createElement("button");
  btnExcluir.textContent = "✖";
  btnExcluir.style.marginLeft = "10px";
  btnExcluir.onclick = () => {
    const index = Array.from(li.parentNode.children).indexOf(li);
    tarefas.splice(index, 1);
    li.remove();
    salvarTarefas();
  };

  li.appendChild(btnExcluir);
  document.getElementById("listaTarefas").appendChild(li);
}

function adicionarTarefa() {
  const input = document.getElementById("novaTarefa");
  const texto = input.value.trim();
  if (texto === "") return;

  tarefas.push({ texto, concluida: false });
const categoria = document.getElementById("categoria").value;
tarefas.push({ texto, concluida: false, categoria });
  salvarTarefas();
  criarElementoTarefa(texto);
  input.value = "";
}

window.onload = carregarTarefas;
tarefas.forEach(t => criarElementoTarefa(t.texto, t.concluida, t.categoria));
document.getElementById("toggleTema").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});
function filtrarTarefas(categoriaSelecionada) {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = "";

  tarefas.forEach(tarefa => {
    if (categoriaSelecionada === "Todas" || tarefa.categoria === categoriaSelecionada) {
      criarElementoTarefa(tarefa.texto, tarefa.concluida, tarefa.categoria);
    }
  });
}
function alternarTema() {
  document.body.classList.toggle('dark');
}

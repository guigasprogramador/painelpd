import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format-currency';
import { Camera, Pencil, Plus, Trash2 } from "lucide-react";
import { clsx } from 'clsx';
import html2canvas from "html2canvas";

interface Entry {
  id: string;
  month_id: number;
  dispos: string;
  lider: string;
  celulas: number;
  meta: number;
  arrecadado: number;
}

interface Month {
  id: number;
  name: string;
}

const DashboardTable = () => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [currentMonth, setCurrentMonth] = React.useState<string>("");
  const [months, setMonths] = React.useState<Month[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isNewEntryDialogOpen, setIsNewEntryDialogOpen] = React.useState(false);
  const [newEntry, setNewEntry] = React.useState<Partial<Entry>>({});
  const [isNewMonthDialogOpen, setIsNewMonthDialogOpen] = React.useState(false);
  const [newMonth, setNewMonth] = React.useState("");
  const [editingEntry, setEditingEntry] = React.useState<Entry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeleteMonthDialogOpen, setIsDeleteMonthDialogOpen] = React.useState(false);

  // Referência para a tabela
  const tableRef = React.useRef<HTMLDivElement>(null);

  // Função para tirar screenshot
  const handleScreenshot = async () => {
    if (!tableRef.current) return;

    try {
      const element = tableRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // Melhor qualidade
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      // Criar link para download
      const link = document.createElement('a');
      link.download = `dashboard-${currentMonth.replace('/', '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: "Screenshot salvo",
        description: "A imagem foi salva com sucesso.",
      });
    } catch (error) {
      console.error('Error taking screenshot:', error);
      toast({
        title: "Erro ao salvar screenshot",
        description: "Não foi possível salvar a imagem.",
        variant: "destructive",
      });
    }
  };

  // Filter entries based on search term
  const filteredEntries = entries.filter(entry => 
    entry.dispos.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.lider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fetch months
  const fetchMonths = async () => {
    const { data: monthsData, error: monthsError } = await supabase
      .from('months')
      .select('*')
      .order('name');

    if (monthsError) {
      toast({
        title: "Erro ao carregar meses",
        description: monthsError.message,
        variant: "destructive",
      });
      return;
    }

    setMonths(monthsData || []);
    if (monthsData && monthsData.length > 0) {
      setCurrentMonth(monthsData[0].name);
    }
  };

  // Fetch entries for current month
  const fetchEntries = async () => {
    console.log('Fetching entries for month:', currentMonth);
    if (!currentMonth) {
      console.log('No current month selected');
      return;
    }

    setIsLoading(true);
    try {
      // Primeiro, buscar o ID do mês atual
      const { data: monthData, error: monthError } = await supabase
        .from('months')
        .select('id')
        .eq('name', currentMonth)
        .single();

      if (monthError) {
        console.error('Error fetching month:', monthError);
        toast({
          title: "Erro ao carregar mês",
          description: monthError.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Found month data:', monthData);

      if (!monthData) {
        console.log('No month data found');
        return;
      }

      // Agora buscar as entradas para este mês
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('id, month_id, dispos, lider, celulas, meta, arrecadado')
        .eq('month_id', monthData.id)
        .order('dispos');

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        toast({
          title: "Erro ao carregar dados",
          description: entriesError.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Found entries:', entriesData);

      // Ordenar as entradas corretamente
      const sortedEntries = (entriesData || []).sort((a, b) => {
        // Se for BISPOS, sempre vem primeiro
        if (a.dispos === 'BISPOS') return -1;
        if (b.dispos === 'BISPOS') return 1;
        
        // Extrair os números dos ADRs
        const numA = parseInt(a.dispos.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.dispos.match(/\d+/)?.[0] || '0');
        
        return numA - numB;
      });

      setEntries(sortedEntries);
      console.log('Entries set:', sortedEntries);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add new month with copied SUBs
  const handleAddMonth = async () => {
    if (!newMonth) return;
    setIsLoading(true);
    
    try {
      console.log('Adding new month:', newMonth);
      console.log('Current month:', currentMonth);

      // Primeiro, buscar as entradas do mês atual
      const { data: currentMonthData, error: currentMonthError } = await supabase
        .from('months')
        .select('id')
        .eq('name', currentMonth)
        .single();

      if (currentMonthError) {
        console.error('Error fetching current month:', currentMonthError);
        throw currentMonthError;
      }

      console.log('Current month data:', currentMonthData);

      const { data: currentEntries, error: currentEntriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('month_id', currentMonthData.id);

      if (currentEntriesError) {
        console.error('Error fetching current entries:', currentEntriesError);
        throw currentEntriesError;
      }

      console.log('Current entries:', currentEntries);

      // Inserir o novo mês
      const { data: newMonthData, error: monthError } = await supabase
        .from('months')
        .insert([{ name: newMonth }])
        .select()
        .single();

      if (monthError) {
        console.error('Error creating new month:', monthError);
        throw monthError;
      }

      console.log('New month created:', newMonthData);

      if (currentEntries && currentEntries.length > 0) {
        try {
          // Preparar as novas entradas mantendo todos os valores exceto arrecadado
          const newEntries = currentEntries.map(entry => {
            // Garantir que os valores numéricos são números válidos
            const celulas = typeof entry.celulas === 'string' ? parseInt(entry.celulas) : entry.celulas;
            const meta = typeof entry.meta === 'string' ? parseFloat(entry.meta) : entry.meta;

            // Truncar strings para o tamanho máximo permitido
            const truncateString = (str: string, maxLength: number) => {
              return str ? str.substring(0, maxLength) : '';
            };

            return {
              month_id: newMonthData.id,
              dispos: truncateString(String(entry.dispos).trim(), 20),
              lider: truncateString(String(entry.lider).trim(), 20),
              celulas: celulas || 0,
              meta: meta || 0,
              arrecadado: 0 // Sempre começa zerado no novo mês
            };
          });

          console.log('Preparing new entries:', JSON.stringify(newEntries, null, 2));

          // Primeiro, vamos verificar se já existem entradas para este mês
          const { data: existingEntries } = await supabase
            .from('entries')
            .select('dispos')
            .eq('month_id', newMonthData.id);

          // Se já existem entradas, vamos deletá-las primeiro
          if (existingEntries && existingEntries.length > 0) {
            await supabase
              .from('entries')
              .delete()
              .eq('month_id', newMonthData.id);
          }

          // Agora vamos inserir todas as entradas de uma vez
          const { error: entriesError } = await supabase
            .from('entries')
            .insert(newEntries);

          if (entriesError) {
            console.error('Error inserting entries:', entriesError);
            console.error('Error details:', JSON.stringify(entriesError, null, 2));
            throw new Error(`Erro ao inserir entradas: ${entriesError.message}`);
          }

          console.log('All entries inserted successfully');
        } catch (error: any) {
          console.error('Error in entries insertion:', error);
          console.error('Full error:', JSON.stringify(error, null, 2));
          throw error;
        }
      }

      // Atualizar o estado local
      setMonths(prev => [...prev, newMonthData]);
      setNewMonth("");
      setIsNewMonthDialogOpen(false);
      setCurrentMonth(newMonth);
      
      // Recarregar os dados
      await fetchEntries();

      toast({
        title: "Mês adicionado",
        description: "O novo mês foi adicionado com sucesso com todas as SUBs.",
      });
    } catch (error: any) {
      console.error('Error in handleAddMonth:', error);
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao adicionar o mês.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add new entry
  const handleAddNew = async () => {
    if (!newEntry.dispos || !newEntry.lider) return;

    const { data: monthData } = await supabase
      .from('months')
      .select('id')
      .eq('name', currentMonth)
      .single();

    if (!monthData) return;

    const newEntryData = {
      month_id: monthData.id,
      dispos: newEntry.dispos,
      lider: newEntry.lider,
      celulas: Number(newEntry.celulas) || 0,
      meta: Number(newEntry.meta) || 0,
      arrecadado: Number(newEntry.arrecadado) || 0
    };

    const { error: insertError } = await supabase
      .from('entries')
      .insert([newEntryData]);

    if (insertError) {
      toast({
        title: "Erro ao adicionar entrada",
        description: insertError.message,
        variant: "destructive",
      });
      return;
    }

    fetchEntries(); // Refresh entries
    setNewEntry({});
    setIsNewEntryDialogOpen(false);
    toast({
      title: "Nova entrada adicionada",
      description: "A entrada foi adicionada com sucesso.",
    });
  };

  // Edit entry
  const handleEditEntry = async () => {
    if (!editingEntry) return;

    const { error: updateError } = await supabase
      .from('entries')
      .update({
        dispos: editingEntry.dispos,
        lider: editingEntry.lider,
        celulas: editingEntry.celulas,
        meta: editingEntry.meta,
        arrecadado: editingEntry.arrecadado
      })
      .eq('id', editingEntry.id);

    if (updateError) {
      toast({
        title: "Erro ao atualizar entrada",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    fetchEntries(); // Refresh entries
    setEditingEntry(null);
    setIsEditDialogOpen(false);
    toast({
      title: "Entrada atualizada",
      description: "A entrada foi atualizada com sucesso.",
    });
  };

  // Delete entry
  const handleDeleteEntry = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('entries')
      .delete()
      .eq('id', id);

    if (deleteError) {
      toast({
        title: "Erro ao remover entrada",
        description: deleteError.message,
        variant: "destructive",
      });
      return;
    }

    fetchEntries(); // Refresh entries
    toast({
      title: "Entrada removida",
      description: "A entrada foi removida com sucesso.",
    });
  };

  // Função para deletar o mês atual
  const handleDeleteMonth = async () => {
    if (!currentMonth) return;

    try {
      setIsLoading(true);
      
      // Primeiro, encontrar o ID do mês
      const { data: monthData } = await supabase
        .from('months')
        .select('id')
        .eq('name', currentMonth)
        .single();

      if (!monthData) {
        throw new Error('Mês não encontrado');
      }

      // Deletar todas as entradas do mês
      const { error: entriesError } = await supabase
        .from('entries')
        .delete()
        .eq('month_id', monthData.id);

      if (entriesError) throw entriesError;

      // Deletar o mês
      const { error: monthError } = await supabase
        .from('months')
        .delete()
        .eq('id', monthData.id);

      if (monthError) throw monthError;

      // Atualizar a lista de meses
      setMonths(months.filter(m => m.name !== currentMonth));
      
      // Se o mês deletado era o atual, selecionar outro mês
      if (months.length > 0) {
        setCurrentMonth(months[0].name);
      } else {
        setCurrentMonth("");
      }

      setIsDeleteMonthDialogOpen(false);
      toast({
        title: "Mês deletado",
        description: "O mês foi deletado com sucesso.",
      });
    } catch (error: any) {
      console.error('Error deleting month:', error);
      toast({
        title: "Erro ao deletar mês",
        description: error.message || "Ocorreu um erro ao deletar o mês.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMonths();
  }, []);

  React.useEffect(() => {
    if (currentMonth) {
      fetchEntries();
    }
  }, [currentMonth]);

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto p-4">
      {/* Cabeçalho com controles */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        {/* Controles do lado esquerdo */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={currentMonth} onValueChange={setCurrentMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.id} value={month.name}>
                  {month.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isNewMonthDialogOpen} onOpenChange={setIsNewMonthDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Mês</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Mês</Label>
                  <Input
                    placeholder="Ex: JANEIRO/25"
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleAddMonth}>Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteMonthDialogOpen} onOpenChange={setIsDeleteMonthDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="text-red-500 hover:text-red-700 shrink-0"
                disabled={!currentMonth}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Deletar Mês</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p>Tem certeza que deseja deletar o mês {currentMonth}?</p>
                <p className="text-red-500 mt-2">Esta ação não pode ser desfeita!</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDeleteMonthDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDeleteMonth}>
                  Deletar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Controles do lado direito */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Pesquisar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-[200px]"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleScreenshot}
            className="shrink-0"
            disabled={!currentMonth}
            title="Screenshot"
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Dialog open={isNewEntryDialogOpen} onOpenChange={setIsNewEntryDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="icon"
                className="shrink-0"
                disabled={!currentMonth}
                title="Nova Sub"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Nova Sub</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>SUB</Label>
                  <Input
                    value={newEntry.dispos || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, dispos: e.target.value })}
                    placeholder="Ex: ADR 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Líder</Label>
                  <Input
                    value={newEntry.lider || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, lider: e.target.value })}
                    placeholder="Nome do líder"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Células</Label>
                  <Input
                    type="number"
                    value={newEntry.celulas || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, celulas: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meta</Label>
                  <Input
                    type="number"
                    value={newEntry.meta || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, meta: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Arrecadado</Label>
                  <Input
                    type="number"
                    value={newEntry.arrecadado || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, arrecadado: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsNewEntryDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddNew}>Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabela responsiva */}
      <div className="bg-white rounded-lg shadow" ref={tableRef}>
        <div className="p-4 bg-[#4CAF50] text-white text-center font-bold text-lg sm:text-xl">
          PD ADRENALINA {currentMonth || "Selecione um mês"}
        </div>
        
        {/* Versão mobile - cards */}
        <div className="block sm:hidden">
          {isLoading ? (
            <div className="p-4 text-center">Carregando...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-4 text-center">Nenhum registro encontrado</div>
          ) : (
            <div className="divide-y">
              {filteredEntries.map((entry) => {
                const percentage = entry.meta ? (entry.arrecadado / entry.meta) * 100 : 0;
                return (
                  <div key={`${entry.month_id}-${entry.dispos}`} className="p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="font-medium">{entry.dispos}</div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingEntry(entry);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">Líder: {entry.lider}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Células: {entry.celulas}</div>
                      <div>Meta: {formatCurrency(entry.meta)}</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>Arrecadado: {formatCurrency(entry.arrecadado)}</div>
                      <div 
                        className={clsx(
                          "font-medium",
                          percentage >= 100 ? "text-green-600" :
                          percentage >= 70 ? "text-yellow-600" :
                          "text-red-600"
                        )}
                      >
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Versão desktop - tabela */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">SUB</TableHead>
                <TableHead className="min-w-[150px]">LÍDER</TableHead>
                <TableHead className="text-center">CÉLULAS</TableHead>
                <TableHead className="text-right">META</TableHead>
                <TableHead className="text-right">ARRECADADO</TableHead>
                <TableHead className="text-right w-[80px]">%</TableHead>
                <TableHead className="text-center w-[100px]">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  const percentage = entry.meta ? (entry.arrecadado / entry.meta) * 100 : 0;
                  return (
                    <TableRow key={`${entry.month_id}-${entry.dispos}`}>
                      <TableCell className="font-medium">{entry.dispos}</TableCell>
                      <TableCell>{entry.lider}</TableCell>
                      <TableCell className="text-center">{entry.celulas}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(entry.meta)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(entry.arrecadado)}
                      </TableCell>
                      <TableCell 
                        className={clsx(
                          "text-right whitespace-nowrap",
                          percentage >= 100 ? "text-green-600" :
                          percentage >= 70 ? "text-yellow-600" :
                          "text-red-600"
                        )}
                      >
                        {percentage.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingEntry(entry);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal de edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Entrada</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>SUB</Label>
                <Input
                  value={editingEntry.dispos}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, dispos: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Líder</Label>
                <Input
                  value={editingEntry.lider}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, lider: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Células</Label>
                <Input
                  type="number"
                  value={editingEntry.celulas}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      celulas: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Meta</Label>
                <Input
                  type="number"
                  value={editingEntry.meta}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      meta: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Arrecadado</Label>
                <Input
                  type="number"
                  value={editingEntry.arrecadado}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      arrecadado: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditEntry}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardTable;

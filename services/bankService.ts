import { supabase } from './supabase';

export interface CustomBank {
    id: string;
    name: string;
    isBroker: boolean;
    createdAt: string;
}

export async function fetchCustomBanks(): Promise<CustomBank[]> {
    const { data, error } = await supabase
        .from('custom_banks')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Erro ao buscar bancos customizados:', error);
        return [];
    }

    return data?.map(row => ({
        id: row.id,
        name: row.name,
        isBroker: row.is_broker,
        createdAt: row.created_at,
    })) || [];
}

export async function addCustomBank(name: string, isBroker: boolean): Promise<CustomBank | null> {
    const { data, error } = await supabase
        .from('custom_banks')
        .insert({ name: name.trim(), is_broker: isBroker })
        .select()
        .single();

    if (error) {
        console.error('Erro ao adicionar banco customizado:', error);
        return null;
    }

    return data ? {
        id: data.id,
        name: data.name,
        isBroker: data.is_broker,
        createdAt: data.created_at,
    } : null;
}

export async function deleteCustomBank(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('custom_banks')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erro ao deletar banco customizado:', error);
        return false;
    }

    return true;
}

import { createClient } from '@supabase/supabase-js'

    // Supabase configuration

    const SUPABASE_URL = 'https://frzqpavvsskrwtpwutjs.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyenFwYXZ2c3Nrcnd0cHd1dGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNjI0ODIsImV4cCI6MjA2MzgzODQ4Mn0.6ntuplKve8fHEwW2LZaRSUcCwwxUYWKq4qeqIggX46A';

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // App state
        let currentUser = null;
        let selectedUserId = null;
        let messagesSubscription = null;

        // DOM elements
        const authSection = document.getElementById('auth-section');
        const chatSection = document.getElementById('chat-section');
        const emailInput = document.getElementById('email-input');
        const proceedButton = document.getElementById('proceed-button');
        const logoutButton = document.getElementById('logout-button');
        const currentUserEmail = document.getElementById('current-user-email');
        const usersList = document.getElementById('users-list');
        const messagesContainer = document.getElementById('messages-container');
        const messagesList = document.getElementById('messages-list');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const chatHeader = document.getElementById('chat-header');
        const chatWith = document.getElementById('chat-with');
        const messageInputArea = document.getElementById('message-input-area');
        const noChatSelected = document.getElementById('no-chat-selected');
        const loading = document.getElementById('loading');

        // Show/hide loading
        function showLoading() {
            loading.classList.remove('hidden');
        }

        function hideLoading() {
            loading.classList.add('hidden');
        }

        // Register or login user
        async function registerUser(email) {
            try {
                showLoading();
                
                // First check if user exists
                const { data: existingUser, error: fetchError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    throw fetchError;
                }

                if (existingUser) {
                    currentUser = existingUser;
                } else {
                    // Generate a UUID for new user
                    const userId = crypto.randomUUID();
                    
                    const { data, error } = await supabase
                        .from('users')
                        .insert([{ id: userId, email: email }])
                        .select()
                        .single();

                    if (error) throw error;
                    currentUser = data;
                }

                showChatSection();
                await loadUsers();
                
            } catch (error) {
                console.error('Error registering user:', error);
                alert('Error: ' + error.message);
            } finally {
                hideLoading();
            }
        }

        // Show chat section
        function showChatSection() {
            authSection.classList.add('hidden');
            chatSection.classList.remove('hidden');
            currentUserEmail.textContent = currentUser.email;
        }

        // Show auth section
        function showAuthSection() {
            chatSection.classList.add('hidden');
            authSection.classList.remove('hidden');
            currentUser = null;
            selectedUserId = null;
        }

        // Load all users except current user
        async function loadUsers() {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .neq('id', currentUser.id)
                    .order('email');

                if (error) throw error;

                usersList.innerHTML = '';
                
                if (data.length === 0) {
                    usersList.innerHTML = '<div class="p-4 text-gray-500 text-sm">No other users found</div>';
                    return;
                }

                data.forEach(user => {
                    const userDiv = document.createElement('div');
                    userDiv.className = 'p-3 hover:bg-gray-100 cursor-pointer border-b user-item';
                    userDiv.dataset.userId = user.id;
                    userDiv.innerHTML = `
                        <div class="font-medium text-gray-800">${user.email}</div>
                    `;
                    
                    userDiv.addEventListener('click', () => selectUser(user));
                    usersList.appendChild(userDiv);
                });

            } catch (error) {
                console.error('Error loading users:', error);
            }
        }

        // Select a user to chat with
        async function selectUser(user) {
            selectedUserId = user.id;
            
            // Update UI
            document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('bg-blue-100');
            });
            document.querySelector(`[data-user-id="${user.id}"]`).classList.add('bg-blue-100');
            
            chatWith.textContent = `Chat with ${user.email}`;
            chatHeader.classList.remove('hidden');
            messageInputArea.classList.remove('hidden');
            noChatSelected.classList.add('hidden');
            messagesList.classList.remove('hidden');

            await loadMessages();
            setupMessagesSubscription();
        }

        // Load messages between current user and selected user
        async function loadMessages() {
            try {
                const { data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${currentUser.id})`)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                displayMessages(data);

            } catch (error) {
                console.error('Error loading messages:', error);
            }
        }

        // Display messages
        function displayMessages(messages) {
            messagesList.innerHTML = '';
            
            messages.forEach(message => {
                const messageDiv = document.createElement('div');
                const isCurrentUser = message.sender_id === currentUser.id;
                
                messageDiv.className = `flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`;
                messageDiv.innerHTML = `
                    <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isCurrentUser 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-white text-gray-800 border'
                    }">
                        <p class="text-sm">${message.message}</p>
                        <p class="text-xs mt-1 opacity-70">
                            ${new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                    </div>
                `;
                
                messagesList.appendChild(messageDiv);
            });

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Send message
        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message || !selectedUserId) return;

            try {
                const { error } = await supabase
                    .from('messages')
                    .insert([{
                        sender_id: currentUser.id,
                        receiver_id: selectedUserId,
                        message: message
                    }]);

                if (error) throw error;

                messageInput.value = '';

            } catch (error) {
                console.error('Error sending message:', error);
                alert('Error sending message');
            }
        }

        // Setup real-time messages subscription
        function setupMessagesSubscription() {
            // Remove existing subscription
            if (messagesSubscription) {
                supabase.removeChannel(messagesSubscription);
            }

            messagesSubscription = supabase
                .channel('messages')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `or(and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${currentUser.id}))`
                }, (payload) => {
                    loadMessages(); // Reload messages when new message is inserted
                })
                .subscribe();
        }

        // Event listeners
        proceedButton.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) {
                alert('Please enter your email');
                return;
            }
            
            if (!email.includes('@')) {
                alert('Please enter a valid email');
                return;
            }

            await registerUser(email);
        });

        logoutButton.addEventListener('click', () => {
            if (messagesSubscription) {
                supabase.removeChannel(messagesSubscription);
            }
            showAuthSection();
        });

        sendButton.addEventListener('click', sendMessage);

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Allow enter key on email input
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                proceedButton.click();
            }
        });
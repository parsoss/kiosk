function setActiveButton(button) {
    const buttons = document.querySelectorAll('.category-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
}

function filterMenu(category) {
    const items = document.querySelectorAll('.menu-item');
    items.forEach(item => {
        if (category === 'all' || item.classList.contains(category)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    function updateOrderList() {
        const inputElement = document.getElementById('orderInput');
        const orderItems = document.getElementById('orderItems');
        const input = inputElement.value.trim();

        if (!orderItems) {
            console.error("Order list element not found!");
            return;
        }

        if (input) {
            const items = input.split(',').map(item => item.trim());
            items.forEach(item => {
                const [menu, quantityStr] = item.split(' ').map(part => part.trim());
                const quantity = parseInt(quantityStr);

                if (menu && quantity && !isNaN(quantity)) {
                    // Check if item already exists in the order list
                    let existingItem = Array.from(orderItems.children).find(listItem => {
                        return listItem.dataset.menu === menu;
                    });

                    if (existingItem) {
                        // Update quantity if item already exists
                        let currentQuantity = parseInt(existingItem.dataset.quantity);
                        currentQuantity += quantity;
                        existingItem.dataset.quantity = currentQuantity;
                        existingItem.querySelector('.quantity').textContent = `${currentQuantity}개`;
                    } else {
                        // Create new item if it doesn't exist
                        const listItem = document.createElement('li');
                        listItem.dataset.menu = menu;
                        listItem.dataset.quantity = quantity;
                        listItem.innerHTML = `${menu} <span class="quantity">${quantity}개</span>`;
                        orderItems.appendChild(listItem);
                    }
                } else {
                    console.warn(`Invalid input for menu: "${menu}" or quantity: "${quantity}"`);
                }
            });
            // Clear the input field after adding to the list
            inputElement.value = '';
        } else {
            console.warn("Input field is empty.");
        }
    }

    // Attach the function to the button click event
    document.getElementById('orderButton').addEventListener('click', updateOrderList);

    // Attach the Enter key event to the input field
    document.getElementById('orderInput').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            updateOrderList();
        }
    });
});
